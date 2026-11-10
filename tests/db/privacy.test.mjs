// Who can see where a task is (migration 0021).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SANDTON, acceptBid, applyMigration, asUser, createDatabase, createUser, migrationFiles, one, placeBid, postTask, refusal,
} from "./harness.mjs";

let db;
let client;
let tasker;
let stranger;

before(async () => {
  db = await createDatabase();
  client = await createUser(db, { name: "Thandi Client" });
  tasker = await createUser(db, { name: "Sipho Tasker" });
  stranger = await createUser(db, { name: "Eve Stranger" });
});

after(async () => {
  await db.close();
});

const PUBLIC_COLUMNS =
  "id, client_id, title, description, category, budget, status, area_text, image_url, scheduled_for, tasker_done_at, created_at, updated_at";

describe("the tasks table", () => {
  it("doesn't let any user read the address or coordinates, including the owner", async () => {
    const taskId = await postTask(db, client);
    for (const userId of [stranger, tasker, client]) {
      for (const columns of ["address_text", "location", "*"]) {
        const message = await asUser(db, userId, () =>
          refusal(() => db.query(`select ${columns} from public.tasks where id = $1`, [taskId]))
        );
        assert.match(message, /permission denied for table tasks/, `${columns} should be unreadable`);
      }
    }
  });

  it("still lets users read every public column of tasks they're allowed to see", async () => {
    const taskId = await postTask(db, client);
    const row = await asUser(db, stranger, async () =>
      (await db.query(`select ${PUBLIC_COLUMNS} from public.tasks where id = $1`, [taskId])).rows[0]
    );
    assert.equal(row.area_text, "Sandton, Gauteng");
    assert.equal(row.title, "Fix a leaking tap");
  });

  it("lets the client write the address when posting and editing", async () => {
    const taskId = await postTask(db, client);
    await asUser(db, client, () => db.query("update public.tasks set address_text = '99 New Road, Sandton' where id = $1", [taskId]));
    assert.equal((await one(db, "select address_text from public.tasks where id = $1", [taskId])).address_text, "99 New Road, Sandton");
  });

  it("returns the new row's public columns to the client who inserts it", async () => {
    const row = await asUser(db, client, async () =>
      (
        await db.query(
          `insert into public.tasks (client_id, title, description, category, budget, location, address_text, area_text)
           values ($1, 'Mow the lawn', 'Small garden', 'Yard Work', 250, 'SRID=4326;POINT(28.05 -26.1)', '5 Hidden Lane', 'Bryanston')
           returning ${PUBLIC_COLUMNS}`,
          [client]
        )
      ).rows[0]
    );
    assert.equal(row.status, "open");
    assert.equal(row.area_text, "Bryanston");
  });

  it("is closed to signed-out requests", async () => {
    await db.exec("set role anon;");
    const message = await refusal(() => db.query("select id from public.tasks"));
    await db.exec("reset role;");
    assert.match(message, /permission denied/);
  });
});

describe("task_private_details()", () => {
  const details = (userId, taskId) =>
    asUser(db, userId, async () => (await db.query("select * from public.task_private_details($1)", [taskId])).rows);

  it("gives the exact address to the client", async () => {
    const taskId = await postTask(db, client);
    const rows = await details(client, taskId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].address_text, "12 Private Street, Sandton, Gauteng");
    assert.ok(Math.abs(rows[0].lat - SANDTON.lat) < 1e-9);
    assert.ok(Math.abs(rows[0].lng - SANDTON.lng) < 1e-9);
  });

  it("gives nothing to strangers or to taskers who have only bid", async () => {
    const taskId = await postTask(db, client);
    await placeBid(db, tasker, taskId);
    assert.deepEqual(await details(stranger, taskId), []);
    assert.deepEqual(await details(tasker, taskId), []);
  });

  it("gives the exact address to the tasker once their bid is accepted", async () => {
    const taskId = await postTask(db, client);
    const bidId = await placeBid(db, tasker, taskId);
    await acceptBid(db, client, bidId);
    const rows = await details(tasker, taskId);
    assert.equal(rows[0].address_text, "12 Private Street, Sandton, Gauteng");
    assert.deepEqual(await details(stranger, taskId), []);
  });
});

describe("nearby_open_tasks()", () => {
  const search = (userId, origin = SANDTON, radius = 20000, category = null) =>
    asUser(db, userId, async () =>
      (await db.query("select * from public.nearby_open_tasks($1, $2, $3, $4)", [origin.lat, origin.lng, radius, category])).rows
    );

  it("returns the area and an approximate position, never the address or exact point", async () => {
    const exact = { lat: -26.10763, lng: 28.05671 };
    const taskId = await postTask(db, client, exact);
    const found = (await search(stranger)).find((row) => row.id === taskId);

    assert.ok(found, "the task shows up in the search");
    assert.equal(found.area_text, "Sandton, Gauteng");
    assert.ok(!("address_text" in found));
    assert.notEqual(found.task_lat, exact.lat);
    assert.notEqual(found.task_lng, exact.lng);
    // Snapped to a 0.005 degree grid: at most half a cell (about 280 m) off on each axis.
    assert.ok(Math.abs(found.task_lat - exact.lat) <= 0.0025 + 1e-9);
    assert.ok(Math.abs(found.task_lng - exact.lng) <= 0.0025 + 1e-9);
    assert.ok(Math.abs(found.task_lat / 0.005 - Math.round(found.task_lat / 0.005)) < 1e-6, "on the grid");
  });

  it("measures distance to the approximate point, so it can't be used to pin down the address", async () => {
    const exact = { lat: -26.10763, lng: 28.05671 };
    const taskId = await postTask(db, client, exact);
    // Standing exactly on the task: an exact distance would be 0.
    const found = (await search(stranger, exact)).find((row) => row.id === taskId);
    assert.ok(found.distance_meters > 50, `expected a snapped distance, got ${found.distance_meters}`);
    assert.ok(found.distance_meters < 500);
  });

  it("leaves out your own tasks, tasks that aren't open, and tasks out of range", async () => {
    const mine = await postTask(db, stranger);
    const assigned = await postTask(db, client);
    await acceptBid(db, client, await placeBid(db, tasker, assigned));
    const farAway = await postTask(db, client, { lat: -33.9249, lng: 18.4241, area: "Cape Town" });
    const nearby = await postTask(db, client);

    const ids = (await search(stranger)).map((row) => row.id);
    assert.ok(ids.includes(nearby));
    assert.ok(!ids.includes(mine));
    assert.ok(!ids.includes(assigned));
    assert.ok(!ids.includes(farAway));
  });

  it("filters by category and sorts nearest first", async () => {
    const near = await postTask(db, client, { category: "Cleaning", lat: SANDTON.lat + 0.01, lng: SANDTON.lng });
    const far = await postTask(db, client, { category: "Cleaning", lat: SANDTON.lat + 0.08, lng: SANDTON.lng });
    const rows = await search(stranger, SANDTON, 20000, "Cleaning");
    const ids = rows.map((row) => row.id);
    assert.ok(rows.every((row) => row.category === "Cleaning"));
    assert.ok(ids.indexOf(near) < ids.indexOf(far));
  });

  it("can't be called while signed out", async () => {
    await db.exec("set role anon;");
    const message = await refusal(() => db.query("select * from public.nearby_open_tasks(-26.1, 28.05)"));
    await db.exec("reset role;");
    assert.match(message, /permission denied/);
  });
});

describe("upgrading a database that has tasks already", () => {
  it("derives each task's public area from its address without exposing a street address", async () => {
    const old = await createDatabase({ upTo: "0020" });
    const owner = await createUser(old, { name: "Old Client" });
    const addresses = {
      "12 Main Rd, Sandton, Gauteng": "Sandton, Gauteng",
      "Unit 4, 8 Rivonia Road, Sandton, Johannesburg": "Sandton, Johannesburg",
      "45 Oak Avenue, Randburg": "Randburg",
      Soweto: "Soweto",
      "17 Vilakazi Street": "Area not specified",
      "": "Area not specified",
    };
    for (const address of Object.keys(addresses)) {
      await old.query(
        `insert into public.tasks (client_id, title, description, category, budget, location, address_text)
         values ($1, 'Old task', 'From before the upgrade', 'Other', 100, 'SRID=4326;POINT(28 -26)', $2)`,
        [owner, address]
      );
    }

    const pending = migrationFiles().filter((file) => file > "0020_safety_and_lifecycle.sql");
    for (const file of pending) await applyMigration(old, file);

    const { rows } = await old.query("select address_text, area_text from public.tasks");
    assert.equal(rows.length, Object.keys(addresses).length);
    for (const row of rows) {
      assert.equal(row.area_text, addresses[row.address_text], `area for "${row.address_text}"`);
    }
    await old.close();
  });
});

describe("re-running the new migrations", () => {
  it("is harmless (they're safe to paste into the SQL Editor twice)", async () => {
    const fresh = await createDatabase();
    for (const file of migrationFiles().filter((name) => name >= "0019")) {
      await applyMigration(fresh, file);
    }
    const owner = await createUser(fresh, { name: "Rerun Client" });
    const taskId = await postTask(fresh, owner);
    assert.equal((await one(fresh, "select area_text from public.tasks where id = $1", [taskId])).area_text, "Sandton, Gauteng");
    await fresh.close();
  });
});
