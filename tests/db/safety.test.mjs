// Job lifecycle, blocking, reports and account deletion (migration 0020).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SANDTON, acceptBid, asUser, createDatabase, createUser, one, payForTask, placeBid, postTask, refusal,
} from "./harness.mjs";

let db;

before(async () => {
  db = await createDatabase();
});

after(async () => {
  await db.close();
});

// Every test gets its own people, so tests can't affect each other.
async function cast() {
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    client: await createUser(db, { name: `Client ${suffix}` }),
    tasker: await createUser(db, { name: `Tasker ${suffix}` }),
    stranger: await createUser(db, { name: `Stranger ${suffix}` }),
  };
}

async function hiredJob(people, amount = 350) {
  const taskId = await postTask(db, people.client);
  const bidId = await placeBid(db, people.tasker, taskId, amount);
  const thread = await acceptBid(db, people.client, bidId);
  return { taskId, bidId, threadId: thread.id };
}

const notifications = async (userId, kind) =>
  (await db.query("select title, body, actor_id from public.notifications where user_id = $1 and kind = $2", [userId, kind])).rows;

const browse = async (userId) =>
  asUser(db, userId, async () =>
    (await db.query("select id from public.nearby_open_tasks($1, $2)", [SANDTON.lat, SANDTON.lng])).rows.map((r) => r.id)
  );

describe("mark_task_done()", () => {
  it("lets the hired tasker flag the job as done and tells the client once", async () => {
    const people = await cast();
    const { taskId } = await hiredJob(people);

    await asUser(db, people.tasker, async () => {
      await db.query("select public.mark_task_done($1)", [taskId]);
      await db.query("select public.mark_task_done($1)", [taskId]);
    });

    const task = await one(db, "select status, tasker_done_at from public.tasks where id = $1", [taskId]);
    assert.equal(task.status, "assigned", "only a payment completes the task");
    assert.ok(task.tasker_done_at);

    const sent = await notifications(people.client, "task_done");
    assert.equal(sent.length, 1);
    assert.match(sent[0].title, /marked the job as done/);
    assert.equal(sent[0].actor_id, people.tasker);
  });

  it("refuses the client, strangers and taskers who weren't hired", async () => {
    const people = await cast();
    const { taskId } = await hiredJob(people);
    for (const userId of [people.client, people.stranger]) {
      const message = await asUser(db, userId, () => refusal(() => db.query("select public.mark_task_done($1)", [taskId])));
      assert.match(message, /Only the tasker hired/);
    }
  });

  it("refuses a task that isn't in progress", async () => {
    const people = await cast();
    const { taskId } = await hiredJob(people);
    await payForTask(db, taskId);
    const message = await asUser(db, people.tasker, () => refusal(() => db.query("select public.mark_task_done($1)", [taskId])));
    assert.match(message, /isn't in progress/);
  });
});

describe("cancel_task()", () => {
  it("lets the client cancel an open task", async () => {
    const people = await cast();
    const taskId = await postTask(db, people.client);
    await asUser(db, people.client, () => db.query("select public.cancel_task($1)", [taskId]));
    assert.equal((await one(db, "select status from public.tasks where id = $1", [taskId])).status, "cancelled");
  });

  it("doesn't let a bidder cancel an open task", async () => {
    const people = await cast();
    const taskId = await postTask(db, people.client);
    await placeBid(db, people.tasker, taskId);
    const message = await asUser(db, people.tasker, () => refusal(() => db.query("select public.cancel_task($1)", [taskId])));
    assert.match(message, /Only the person who posted/);
  });

  it("lets either side cancel a job in progress and tells the other", async () => {
    const byTasker = await cast();
    const first = await hiredJob(byTasker);
    await asUser(db, byTasker.tasker, () => db.query("select public.cancel_task($1)", [first.taskId]));
    assert.equal((await one(db, "select status from public.tasks where id = $1", [first.taskId])).status, "cancelled");
    assert.equal((await notifications(byTasker.client, "task_cancelled")).length, 1);
    assert.equal((await notifications(byTasker.tasker, "task_cancelled")).length, 0);

    const byClient = await cast();
    const second = await hiredJob(byClient);
    await asUser(db, byClient.client, () => db.query("select public.cancel_task($1)", [second.taskId]));
    assert.equal((await notifications(byClient.tasker, "task_cancelled")).length, 1);
  });

  it("refuses strangers, and refuses once the job is paid", async () => {
    const people = await cast();
    const { taskId } = await hiredJob(people);
    const asStranger = await asUser(db, people.stranger, () => refusal(() => db.query("select public.cancel_task($1)", [taskId])));
    assert.match(asStranger, /Only the client or the hired tasker/);

    await payForTask(db, taskId);
    const afterPayment = await asUser(db, people.client, () => refusal(() => db.query("select public.cancel_task($1)", [taskId])));
    assert.match(afterPayment, /can no longer be cancelled/);
    assert.equal((await one(db, "select status from public.tasks where id = $1", [taskId])).status, "completed");
  });
});

describe("blocking", () => {
  const block = (blocker, blocked) =>
    asUser(db, blocker, () =>
      db.query("insert into public.user_blocks (blocker_id, blocked_id) values ($1, $2)", [blocker, blocked])
    );

  it("stops the blocked person bidding, in both directions", async () => {
    const people = await cast();
    const taskId = await postTask(db, people.client);
    await block(people.client, people.tasker);
    assert.match(await refusal(() => placeBid(db, people.tasker, taskId)), /can't bid on this task/);

    // The other way round: the tasker blocked the client, and still can't bid on their task.
    const others = await cast();
    const otherTask = await postTask(db, others.client);
    await block(others.tasker, others.client);
    assert.match(await refusal(() => placeBid(db, others.tasker, otherTask)), /can't bid on this task/);
  });

  it("stops a withdrawn bid being put back after a block", async () => {
    const people = await cast();
    const taskId = await postTask(db, people.client);
    const bidId = await placeBid(db, people.tasker, taskId);
    await asUser(db, people.tasker, () => db.query("update public.bids set status = 'withdrawn' where id = $1", [bidId]));
    await block(people.client, people.tasker);
    const message = await asUser(db, people.tasker, () =>
      refusal(() => db.query("update public.bids set status = 'pending' where id = $1", [bidId]))
    );
    assert.match(message, /can't bid on this task/);
  });

  it("stops messages in both directions, and unblocking restores them", async () => {
    const people = await cast();
    const { threadId } = await hiredJob(people);
    const send = (sender) =>
      asUser(db, sender, () =>
        refusal(() => db.query("insert into public.chat_messages (thread_id, sender_id, body) values ($1, $2, 'hello')", [threadId, sender]))
      );

    assert.equal(await send(people.tasker), null);
    await block(people.client, people.tasker);
    assert.match(await send(people.tasker), /can't send messages/);
    assert.match(await send(people.client), /can't send messages/);

    await asUser(db, people.client, () =>
      db.query("delete from public.user_blocks where blocker_id = $1 and blocked_id = $2", [people.client, people.tasker])
    );
    assert.equal(await send(people.tasker), null);
  });

  it("hides each person's tasks from the other in Browse", async () => {
    const people = await cast();
    const taskId = await postTask(db, people.client);
    assert.ok((await browse(people.tasker)).includes(taskId));
    assert.ok((await browse(people.stranger)).includes(taskId));

    await block(people.tasker, people.client);
    assert.ok(!(await browse(people.tasker)).includes(taskId));
    assert.ok((await browse(people.stranger)).includes(taskId), "other people still see it");
  });

  it("is visible only to the person who did the blocking", async () => {
    const people = await cast();
    await block(people.client, people.tasker);
    const seenBy = async (userId) =>
      asUser(db, userId, async () => (await db.query("select 1 from public.user_blocks where blocker_id = $1", [people.client])).rows.length);
    assert.equal(await seenBy(people.client), 1);
    assert.equal(await seenBy(people.tasker), 0);
    assert.equal(await seenBy(people.stranger), 0);
  });

  it("can't be done in someone else's name, or to yourself", async () => {
    const people = await cast();
    const forged = await asUser(db, people.stranger, () =>
      refusal(() => db.query("insert into public.user_blocks (blocker_id, blocked_id) values ($1, $2)", [people.client, people.tasker]))
    );
    assert.match(forged, /row-level security/);
    assert.match(await refusal(() => block(people.client, people.client)), /user_blocks_not_self/);
  });
});

describe("reports", () => {
  it("can be filed against a user or a task, and read back only by the reporter", async () => {
    const people = await cast();
    const taskId = await postTask(db, people.client);
    await asUser(db, people.tasker, async () => {
      await db.query(
        "insert into public.reports (reporter_id, reported_user_id, task_id, reason, details) values ($1, $2, $3, 'scam_or_fraud', 'Asked for payment outside the app')",
        [people.tasker, people.client, taskId]
      );
    });
    const count = async (userId) =>
      asUser(db, userId, async () => (await db.query("select 1 from public.reports where reported_user_id = $1", [people.client])).rows.length);
    assert.equal(await count(people.tasker), 1);
    assert.equal(await count(people.client), 0, "the reported person can't see the report");
    assert.equal(await count(people.stranger), 0);
  });

  it("can't be forged, self-directed, pre-resolved or empty", async () => {
    const people = await cast();
    const file = (userId, columns) =>
      asUser(db, userId, () =>
        refusal(() =>
          db.query(
            `insert into public.reports (reporter_id, reported_user_id, reason, status) values ($1, $2, $3, $4)`,
            columns
          )
        )
      );
    assert.match(await file(people.stranger, [people.tasker, people.client, "spam", "open"]), /row-level security/);
    assert.match(await file(people.tasker, [people.tasker, people.tasker, "spam", "open"]), /row-level security/);
    assert.match(await file(people.tasker, [people.tasker, people.client, "spam", "resolved"]), /row-level security/);
    assert.match(await file(people.tasker, [people.tasker, null, "spam", "open"]), /row-level security/);
    assert.match(await file(people.tasker, [people.tasker, people.client, "because", "open"]), /reports_reason_check/);
  });

  it("can't be edited or deleted by the reporter afterwards", async () => {
    const people = await cast();
    await asUser(db, people.tasker, async () => {
      await db.query("insert into public.reports (reporter_id, reported_user_id, reason) values ($1, $2, 'spam')", [people.tasker, people.client]);
      await db.query("update public.reports set status = 'dismissed' where reporter_id = $1", [people.tasker]);
      await db.query("delete from public.reports where reporter_id = $1", [people.tasker]);
    });
    assert.equal((await one(db, "select status from public.reports where reporter_id = $1", [people.tasker])).status, "open");
  });
});

describe("delete_my_account()", () => {
  it("is refused while the user has a job in progress, as client or as tasker", async () => {
    const people = await cast();
    await hiredJob(people);
    for (const userId of [people.client, people.tasker]) {
      const message = await asUser(db, userId, () => refusal(() => db.query("select public.delete_my_account()")));
      assert.match(message, /job in progress/);
    }
    assert.ok(await one(db, "select 1 as ok from auth.users where id = $1", [people.client]));
  });

  it("removes the account and everything it owns, and leaves other people intact", async () => {
    const people = await cast();
    const openTask = await postTask(db, people.client);
    await placeBid(db, people.tasker, openTask);
    const { taskId: paidTask, threadId } = await hiredJob(people);
    await asUser(db, people.client, () =>
      db.query("insert into public.chat_messages (thread_id, sender_id, body) values ($1, $2, 'Thanks')", [threadId, people.client])
    );
    await payForTask(db, paidTask);
    await asUser(db, people.client, () => db.query("select public.submit_rating($1, $2, 5::smallint, 'Great')", [paidTask, people.tasker]));
    assert.equal((await one(db, "select rating_count from public.profiles where id = $1", [people.tasker])).rating_count, 1);

    await asUser(db, people.client, () => db.query("select public.delete_my_account()"));

    const remaining = async (sql) => (await one(db, sql, [people.client])).count;
    assert.equal(await remaining("select count(*)::int as count from auth.users where id = $1"), 0);
    assert.equal(await remaining("select count(*)::int as count from public.profiles where id = $1"), 0);
    assert.equal(await remaining("select count(*)::int as count from public.tasks where client_id = $1"), 0);
    assert.equal(await remaining("select count(*)::int as count from public.chat_messages where sender_id = $1"), 0);
    assert.equal(await remaining("select count(*)::int as count from public.ratings where rater_id = $1"), 0);

    // The tasker is still there, and their rating no longer counts the deleted review.
    assert.deepEqual(await one(db, "select rating_avg, rating_count from public.profiles where id = $1", [people.tasker]), {
      rating_avg: "0.00",
      rating_count: 0,
    });
  });

  it("keeps a report about the deleted account's behaviour, minus the link to them", async () => {
    const people = await cast();
    await asUser(db, people.client, () =>
      db.query("insert into public.reports (reporter_id, reported_user_id, reason) values ($1, $2, 'harassment')", [people.client, people.tasker])
    );
    await asUser(db, people.tasker, () => db.query("select public.delete_my_account()"));
    assert.deepEqual(await one(db, "select reported_user_id, reason from public.reports where reporter_id = $1", [people.client]), {
      reported_user_id: null,
      reason: "harassment",
    });
  });

  it("can't be called while signed out", async () => {
    await db.exec("set role anon;");
    const message = await refusal(() => db.query("select public.delete_my_account()"));
    await db.exec("reset role;");
    assert.match(message, /permission denied/);
  });
});
