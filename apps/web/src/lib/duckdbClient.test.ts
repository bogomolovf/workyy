import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import * as duckdbClient from "./duckdbClient";

const DEMO_BOARD_ID = "demo-board-id";
const OTHER_BOARD_ID = "other-board-id";

describe("duckdbClient dataset isolation", () => {
  let connection: { query: ReturnType<typeof vi.fn> };
  let currentTables: string[];

  beforeAll(() => {
    duckdbClient.__setDemoBoardIdForTests(DEMO_BOARD_ID);
  });

  afterAll(() => {
    duckdbClient.__setDemoBoardIdForTests(null);
  });

  beforeEach(() => {
    currentTables = [];
    connection = {
      query: vi.fn(async (sql: string) => {
        if (typeof sql === "string" && sql.includes("FROM information_schema.tables")) {
          return {
            toArray: () => currentTables.map((table_name) => ({ table_name })),
          };
        }
        return undefined;
      }),
    };
    duckdbClient.__setDuckDbContextTestOverride({ connection, db: {} } as any);
    window.localStorage.clear();
  });

  afterEach(() => {
    duckdbClient.__setDuckDbContextTestOverride(null);
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("drops all user tables in resetUserTables", async () => {
    currentTables = ["demo_data", "team_metrics", "board_data"];

    await duckdbClient.resetUserTables(connection as any);

    const dropCalls = connection.query.mock.calls
      .map(([sql]) => sql)
      .filter((sql): sql is string => typeof sql === "string" && sql.startsWith("DROP TABLE IF EXISTS"));

    expect(dropCalls).toHaveLength(3);
    expect(dropCalls[0]).toBe('DROP TABLE IF EXISTS "demo_data";');
    expect(dropCalls[1]).toBe('DROP TABLE IF EXISTS "team_metrics";');
    expect(dropCalls[2]).toBe('DROP TABLE IF EXISTS "board_data";');
  });

  it("resets user tables before restoring datasets for a different board", async () => {
    const datasetA = [
      {
        tableName: "sales_a",
        columns: ["region", "revenue"],
        rows: [
          ["EU", "100"],
          ["US", "200"],
        ],
      },
    ];
    const datasetB = [
      {
        tableName: "sales_b",
        columns: ["region", "revenue"],
        rows: [
          ["APAC", "300"],
        ],
      },
    ];

    window.localStorage.setItem(`workyy_board_datasets_v2:${OTHER_BOARD_ID}`, JSON.stringify(datasetA));
    window.localStorage.setItem(`workyy_board_datasets_v2:${OTHER_BOARD_ID}-2`, JSON.stringify(datasetB));

    currentTables = ["demo_data", "legacy_temp"];
    await duckdbClient.restoreDatasetsForBoard(OTHER_BOARD_ID);

    currentTables = ["demo_data", "sales_a"];
    connection.query.mockClear();

    await duckdbClient.restoreDatasetsForBoard(`${OTHER_BOARD_ID}-2`);

    const dropDemoCall = connection.query.mock.calls.some(
      ([sql]) => typeof sql === "string" && sql.startsWith('DROP TABLE IF EXISTS "demo_data"'),
    );
    expect(dropDemoCall).toBe(true);

    const userSqlCalls = connection.query.mock.calls
      .map(([sql]) => sql)
      .filter(
        (sql): sql is string =>
          typeof sql === "string" && !sql.includes("information_schema") && !sql.includes('"demo_data"'),
      );

    expect(userSqlCalls).toHaveLength(4);
    expect(userSqlCalls[0]).toBe('DROP TABLE IF EXISTS "sales_a";');
    expect(userSqlCalls[1]).toBe('DROP TABLE IF EXISTS "sales_b";');
    expect(userSqlCalls[2]).toMatch('CREATE TABLE "sales_b"');
    expect(userSqlCalls[3]).toMatch('INSERT INTO "sales_b" VALUES');
    expect(
      userSqlCalls.some((sql) => sql.startsWith('CREATE TABLE "demo_data"')),
    ).toBe(false);
  });

  it("keeps demo_data only for the demo board", async () => {
    currentTables = [];
    await duckdbClient.restoreDatasetsForBoard(DEMO_BOARD_ID);
    const createCalls = connection.query.mock.calls
      .map(([sql]) => sql)
      .filter((sql): sql is string => typeof sql === "string" && sql.includes('CREATE TABLE "demo_data"'));
    expect(createCalls.length).toBeGreaterThan(0);

    connection.query.mockClear();
    currentTables = ["demo_data"];
    await duckdbClient.restoreDatasetsForBoard("regular-board");
    const createCallsRegular = connection.query.mock.calls
      .map(([sql]) => sql)
      .filter((sql): sql is string => typeof sql === "string" && sql.includes('CREATE TABLE "demo_data"'));
    expect(createCallsRegular).toHaveLength(0);
  });
});

