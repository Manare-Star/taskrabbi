// What a signed-in user can and can't change by calling the API directly (migration 0019).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  acceptBid, asService, asUser, createDatabase, createUser, one, payForTask, placeBid, postTask, refusal,
} from "./harness.mjs";

let db;
let client;
let tasker;
let otherTasker;
let stranger;

before(async () => {
  db = await createDatabase();
  client = await createUser(db, { name: "Thandi Client" });
  tasker = await createUser(db, { name: "Sipho Tasker" });
  otherTasker = await createUser(db, { name: "Lerato Tasker" });
  stranger = await createUser(db, { name: "Eve Stranger" });
});

after(async () => {
  await db.close();
});

describe("tasks", () => {
  it("always start out open, whatever status the request asks for", async () => {
    const id = await asUser(db, client, async () => {
      const { rows } = await db.query(
        `insert into public.tasks (client_id, title, description, category, budget, location, address_text, area_text, status)
         values ($1, 'Paint a wall', 'One wall', 'Handyman', 500, 'SRID=4326;POINT(28 -26)', '1 Road', 'Sandton', 'completed')
         returning id`,
        [client]
      );
      return rows[0].id;
    });
    assert.equal((await one(db, "select status from public.tasks where id = $1", [id])).status, "open");
  });

  it("can't be marked completed by the client without a payment", async () => {
    const taskId = await postTask(db, client);
    const bidId = await placeBid(db, tasker, taskId);
    await acceptBid(db, client, bidId);

    const message = await asUser(db, client, () =>
      refusal(() => db.query("update public.tasks set status = 'completed' where id = $1", [taskId]))
    );
    assert.match(message, /can no longer be changed/);
    assert.equal((await one(db, "select status from public.tasks where id = $1", [taskId])).status, "assigned");
  });

  it("can't be assigned or completed directly while open", async () => {
    const taskId = await postTask(db, client);
    for (const status of ["assigned", "completed"]) {
      const message = await asUser(db, client, () =>
        refusal(() => db.query("update public.tasks set status = $2 where id = $1", [taskId, status]))
      );
      assert.match(message, /assigned by accepting a bid/);
    }
  });

  it("can be edited and cancelled by the client while open", async () => {
    const taskId = await postTask(db, client);
    await asUser(db, client, async () => {
      await db.query("update public.tasks set budget = 450, title = 'Fix two taps' where id = $1", [taskId]);
      await db.query("update public.tasks set status = 'cancelled' where id = $1", [taskId]);
    });
    const task = await one(db, "select status, budget, title from public.tasks where id = $1", [taskId]);
    assert.deepEqual(task, { status: "cancelled", budget: "450.00", title: "Fix two taps" });
  });

  it("can't be handed to a different owner", async () => {
    const taskId = await postTask(db, client);
    await asUser(db, client, () =>
      db.query("update public.tasks set client_id = $2 where id = $1", [taskId, stranger]).catch(() => {})
    );
    assert.equal((await one(db, "select client_id from public.tasks where id = $1", [taskId])).client_id, client);
  });

  it("can't be changed by someone who doesn't own them", async () => {
    const taskId = await postTask(db, client);
    await asUser(db, stranger, () => db.query("update public.tasks set budget = 1 where id = $1", [taskId]));
    assert.equal((await one(db, "select budget from public.tasks where id = $1", [taskId])).budget, "400.00");
  });

  it("are completed by the payment path, which notifies the tasker exactly once", async () => {
    const taskId = await postTask(db, client);
    const bidId = await placeBid(db, tasker, taskId, 380);
    await acceptBid(db, client, bidId);

    await payForTask(db, taskId, 380);
    await payForTask(db, taskId, 380); // webhook and app both confirming the same payment

    assert.equal((await one(db, "select status from public.tasks where id = $1", [taskId])).status, "completed");
    const { count } = await one(
      db,
      "select count(*)::int as count from public.notifications where task_id = $1 and kind = 'task_paid' and user_id = $2",
      [taskId, tasker]
    );
    assert.equal(count, 1);
  });

  it("reject titles that are too short or too long", async () => {
    assert.match(await refusal(() => postTask(db, client, { title: "ab" })), /tasks_title_length/);
    assert.match(await refusal(() => postTask(db, client, { title: "x".repeat(121) })), /tasks_title_length/);
    assert.match(await refusal(() => postTask(db, client, { budget: 1000001 })), /tasks_budget_max/);
  });
});

describe("bids", () => {
  it("can't be accepted by the tasker who placed them", async () => {
    const taskId = await postTask(db, client);
    const bidId = await placeBid(db, tasker, taskId);
    const message = await asUser(db, tasker, () =>
      refusal(() => db.query("update public.bids set status = 'accepted' where id = $1", [bidId]))
    );
    assert.match(message, /can no longer be changed/);
    assert.equal((await one(db, "select status from public.bids where id = $1", [bidId])).status, "pending");
  });

  it("always start out pending", async () => {
    const taskId = await postTask(db, client);
    const bidId = await asUser(db, tasker, async () => {
      const { rows } = await db.query(
        "insert into public.bids (task_id, tasker_id, amount, status) values ($1, $2, 300, 'accepted') returning id",
        [taskId, tasker]
      );
      return rows[0].id;
    });
    assert.equal((await one(db, "select status from public.bids where id = $1", [bidId])).status, "pending");
  });

  it("can't have their amount changed by the client", async () => {
    const taskId = await postTask(db, client);
    const bidId = await placeBid(db, tasker, taskId, 500);
    const message = await asUser(db, client, () =>
      refusal(() => db.query("update public.bids set amount = 1 where id = $1", [bidId]))
    );
    assert.match(message, /Only the tasker can change their bid/);
    assert.equal((await one(db, "select amount from public.bids where id = $1", [bidId])).amount, "500.00");
  });

  it("can't be accepted by the client except through accept_bid()", async () => {
    const taskId = await postTask(db, client);
    const bidId = await placeBid(db, tasker, taskId);
    const message = await asUser(db, client, () =>
      refusal(() => db.query("update public.bids set status = 'accepted' where id = $1", [bidId]))
    );
    assert.match(message, /Use Accept bid/);
  });

  it("can be declined by the client", async () => {
    const taskId = await postTask(db, client);
    const bidId = await placeBid(db, tasker, taskId);
    await asUser(db, client, () => db.query("update public.bids set status = 'rejected' where id = $1", [bidId]));
    assert.equal((await one(db, "select status from public.bids where id = $1", [bidId])).status, "rejected");
  });

  it("can be revised, withdrawn and put back by the tasker while the task is open", async () => {
    const taskId = await postTask(db, client);
    const bidId = await placeBid(db, tasker, taskId, 500);
    await asUser(db, tasker, async () => {
      await db.query("update public.bids set amount = 450 where id = $1", [bidId]);
      await db.query("update public.bids set status = 'withdrawn' where id = $1", [bidId]);
      await db.query("update public.bids set status = 'pending', amount = 420 where id = $1", [bidId]);
    });
    assert.deepEqual(await one(db, "select status, amount from public.bids where id = $1", [bidId]), {
      status: "pending",
      amount: "420.00",
    });
  });

  it("can't be put back once the task has gone to someone else", async () => {
    const taskId = await postTask(db, client);
    const withdrawn = await placeBid(db, tasker, taskId);
    const winning = await placeBid(db, otherTasker, taskId);
    await asUser(db, tasker, () => db.query("update public.bids set status = 'withdrawn' where id = $1", [withdrawn]));
    await acceptBid(db, client, winning);

    const message = await asUser(db, tasker, () =>
      refusal(() => db.query("update public.bids set status = 'pending' where id = $1", [withdrawn]))
    );
    assert.match(message, /can no longer be changed/);
  });

  it("can't be placed on your own task", async () => {
    const taskId = await postTask(db, client);
    assert.match(await refusal(() => placeBid(db, client, taskId)), /your own task/);
  });

  it("can't be placed in someone else's name", async () => {
    const taskId = await postTask(db, client);
    const message = await asUser(db, stranger, () =>
      refusal(() => db.query("insert into public.bids (task_id, tasker_id, amount) values ($1, $2, 100)", [taskId, tasker]))
    );
    assert.match(message, /row-level security/);
  });

  it("are hidden from other taskers", async () => {
    const taskId = await postTask(db, client);
    await placeBid(db, tasker, taskId, 500);
    const seen = await asUser(db, otherTasker, async () => (await db.query("select amount from public.bids where task_id = $1", [taskId])).rows);
    assert.deepEqual(seen, []);
  });
});

describe("accept_bid()", () => {
  it("assigns the task, declines the other bids and opens the chat", async () => {
    const taskId = await postTask(db, client);
    const winning = await placeBid(db, tasker, taskId);
    const losing = await placeBid(db, otherTasker, taskId);

    const thread = await acceptBid(db, client, winning);

    assert.equal(thread.tasker_id, tasker);
    assert.equal((await one(db, "select status from public.tasks where id = $1", [taskId])).status, "assigned");
    assert.equal((await one(db, "select status from public.bids where id = $1", [winning])).status, "accepted");
    assert.equal((await one(db, "select status from public.bids where id = $1", [losing])).status, "rejected");
  });

  it("refuses a bid that was withdrawn or declined", async () => {
    const taskId = await postTask(db, client);
    const withdrawn = await placeBid(db, tasker, taskId);
    const declined = await placeBid(db, otherTasker, taskId);
    await asUser(db, tasker, () => db.query("update public.bids set status = 'withdrawn' where id = $1", [withdrawn]));
    await asUser(db, client, () => db.query("update public.bids set status = 'rejected' where id = $1", [declined]));

    assert.match(await refusal(() => acceptBid(db, client, withdrawn)), /no longer available/);
    assert.match(await refusal(() => acceptBid(db, client, declined)), /no longer available/);
    assert.equal((await one(db, "select status from public.tasks where id = $1", [taskId])).status, "open");
  });

  it("refuses anyone but the task's client", async () => {
    const taskId = await postTask(db, client);
    const bidId = await placeBid(db, tasker, taskId);
    assert.match(await refusal(() => acceptBid(db, tasker, bidId)), /only the task client/);
    assert.match(await refusal(() => acceptBid(db, stranger, bidId)), /only the task client/);
  });
});

describe("profiles", () => {
  it("can't have their rating edited by their owner", async () => {
    await asUser(db, tasker, () =>
      db.query("update public.profiles set rating_avg = 5, rating_count = 999, bio = 'Plumber, 10 years' where id = $1", [tasker])
    );
    assert.deepEqual(await one(db, "select rating_avg, rating_count, bio from public.profiles where id = $1", [tasker]), {
      rating_avg: "0.00",
      rating_count: 0,
      bio: "Plumber, 10 years",
    });
  });

  it("can't be edited by anyone else", async () => {
    await asUser(db, stranger, () => db.query("update public.profiles set full_name = 'Hacked' where id = $1", [client]));
    assert.equal((await one(db, "select full_name from public.profiles where id = $1", [client])).full_name, "Thandi Client");
  });

  it("get their rating from submit_rating() after a completed task", async () => {
    const taskId = await postTask(db, client);
    const bidId = await placeBid(db, otherTasker, taskId);
    await acceptBid(db, client, bidId);
    await payForTask(db, taskId);

    await asUser(db, client, () => db.query("select public.submit_rating($1, $2, 4::smallint, 'Good work')", [taskId, otherTasker]));

    assert.deepEqual(await one(db, "select rating_avg, rating_count from public.profiles where id = $1", [otherTasker]), {
      rating_avg: "4.00",
      rating_count: 1,
    });
  });
});

describe("chat", () => {
  it("threads can't be opened by hand, only by accept_bid()", async () => {
    const taskId = await postTask(db, client);
    const message = await asUser(db, stranger, () =>
      refusal(() =>
        db.query("insert into public.chat_threads (task_id, client_id, tasker_id) values ($1, $2, $3)", [taskId, client, stranger])
      )
    );
    assert.match(message, /row-level security/);
  });

  it("messages are limited to the two participants and can't be empty", async () => {
    const taskId = await postTask(db, client);
    const bidId = await placeBid(db, tasker, taskId);
    const thread = await acceptBid(db, client, bidId);

    await asUser(db, tasker, () =>
      db.query("insert into public.chat_messages (thread_id, sender_id, body) values ($1, $2, 'On my way')", [thread.id, tasker])
    );
    const asStranger = await asUser(db, stranger, async () => ({
      read: (await db.query("select body from public.chat_messages where thread_id = $1", [thread.id])).rows,
      write: await refusal(() =>
        db.query("insert into public.chat_messages (thread_id, sender_id, body) values ($1, $2, 'hi')", [thread.id, stranger])
      ),
    }));
    assert.deepEqual(asStranger.read, []);
    assert.match(asStranger.write, /row-level security/);

    const empty = await asUser(db, client, () =>
      refusal(() => db.query("insert into public.chat_messages (thread_id, sender_id, body) values ($1, $2, '   ')", [thread.id, client]))
    );
    assert.match(empty, /chat_messages_body_length/);
  });
});

describe("payments", () => {
  it("can't be written by users, only read by the two people on the task", async () => {
    const taskId = await postTask(db, client);
    const bidId = await placeBid(db, tasker, taskId);
    await acceptBid(db, client, bidId);

    const forged = await asUser(db, client, () =>
      refusal(() =>
        db.query("insert into public.payments (task_id, reference, amount, status) values ($1, 'fake', 1, 'succeeded')", [taskId])
      )
    );
    assert.match(forged, /row-level security/);

    await asService(db, () =>
      db.query("insert into public.payments (task_id, reference, amount, status) values ($1, 'ref-1', 350, 'pending')", [taskId])
    );
    const read = async (userId) =>
      asUser(db, userId, async () => (await db.query("select status from public.payments where task_id = $1", [taskId])).rows.length);
    assert.equal(await read(client), 1);
    assert.equal(await read(tasker), 1);
    assert.equal(await read(stranger), 0);
  });
});
