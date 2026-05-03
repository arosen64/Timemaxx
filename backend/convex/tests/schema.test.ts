import { describe, expect, test } from "vitest";
import schema from "../schema";
import { makeTestCtx, createTestUser } from "../../convex-tests/helpers";

/**
 * Schema invariant tests.
 *
 * These tests assert the shape of `backend/convex/schema.ts` so that any
 * additive or breaking change (renamed field, type widening/narrowing, dropped
 * index, optional → required transition, etc.) fails here with a clear message
 * instead of surfacing later as a runtime error.
 *
 * The schema is introspected via `schema.export()`, which returns a stable
 * JSON serialization of every table's document type, indexes, search indexes,
 * and vector indexes.
 */

type FieldType =
  | { type: "string" }
  | { type: "number" }
  | { type: "float64" }
  | { type: "boolean" }
  | { type: "any" }
  | { type: "id"; tableName: string }
  | { type: "literal"; value: unknown }
  | { type: "array"; value: FieldType }
  | { type: "object"; value: Record<string, FieldEntry> }
  | { type: "union"; value: FieldType[] };

type FieldEntry = {
  fieldType: FieldType;
  optional: boolean;
};

type IndexEntry = { indexDescriptor: string; fields: string[] };
type VectorIndexEntry = {
  indexDescriptor: string;
  vectorField: string;
  dimensions: number;
  filterFields: string[];
};

type ExportedTable = {
  tableName: string;
  documentType: { type: "object"; value: Record<string, FieldEntry> };
  indexes: IndexEntry[];
  searchIndexes: unknown[];
  vectorIndexes: VectorIndexEntry[];
};

type ExportedSchema = {
  tables: ExportedTable[];
  schemaValidation: boolean;
};

const exported: ExportedSchema = JSON.parse((schema as unknown as { export(): string }).export());
const tablesByName = new Map(exported.tables.map((t) => [t.tableName, t]));

function getTable(name: string): ExportedTable {
  const table = tablesByName.get(name);
  if (!table) {
    throw new Error(
      `Schema is missing table "${name}". Existing tables: ${[...tablesByName.keys()].join(", ")}`
    );
  }
  return table;
}

function getField(tableName: string, fieldName: string): FieldEntry {
  const table = getTable(tableName);
  const field = table.documentType.value[fieldName];
  if (!field) {
    throw new Error(
      `Table "${tableName}" is missing field "${fieldName}". Existing fields: ${Object.keys(
        table.documentType.value
      ).join(", ")}`
    );
  }
  return field;
}

/**
 * Snapshot: expected fields per user-defined table.
 *
 * Each entry is `[fieldName, expectedFieldType, optional]`. When this list
 * diverges from `schema.ts`, the corresponding test fails and the developer
 * gets a precise pointer to the table/field that drifted.
 *
 * `expectedFieldType` is matched recursively against the validator JSON; only
 * the keys present in the expected value are asserted, which keeps the
 * snapshot focused on schema-level intent rather than serializer details.
 */
const TABLE_FIELD_SPEC: Record<string, Array<[string, Partial<FieldType>, boolean]>> = {
  calendarConnections: [
    ["userId", { type: "id", tableName: "users" }, false],
    ["accessToken", { type: "string" }, false],
    ["refreshToken", { type: "string" }, false],
    ["expiresAt", { type: "number" }, false],
    ["selectedCalendarIds", { type: "array" }, true],
    ["scope", { type: "string" }, true],
    ["timemaxxCalendarId", { type: "string" }, true],
  ],
  calendarOAuthStates: [
    ["userId", { type: "id", tableName: "users" }, false],
    ["state", { type: "string" }, false],
    ["expiresAt", { type: "number" }, false],
  ],
  users: [
    ["name", { type: "string" }, true],
    ["email", { type: "string" }, true],
    ["image", { type: "string" }, true],
    ["emailVerificationTime", { type: "number" }, true],
    ["isAnonymous", { type: "boolean" }, true],
    ["onboardingComplete", { type: "boolean" }, true],
    ["focusBlockLength", { type: "number" }, true],
    ["major", { type: "string" }, true],
    ["year", { type: "union" }, true],
    ["workHoursGrid", { type: "array" }, true],
    ["productivityTraits", { type: "object" }, true],
    ["transcriptSummary", { type: "array" }, true],
    ["gcalColorMappingEnabled", { type: "boolean" }, true],
  ],
  userCourses: [
    ["userId", { type: "id", tableName: "users" }, false],
    ["courseCode", { type: "string" }, false],
    ["title", { type: "string" }, false],
    ["description", { type: "string" }, true],
    ["prereqs", { type: "array" }, true],
    ["embedding", { type: "array" }, true],
    ["credits", { type: "number" }, true],
    ["term", { type: "string" }, false],
    ["grade", { type: "string" }, true],
    ["studyGoal", { type: "string" }, true],
    ["difficultyRating", { type: "number" }, true],
    ["color", { type: "string" }, true],
  ],
  tasks: [
    ["userId", { type: "id", tableName: "users" }, false],
    ["title", { type: "string" }, false],
    ["description", { type: "string" }, false],
    ["taskType", { type: "string" }, false],
    ["timeEstimate", { type: "number" }, true],
    ["isManualEstimate", { type: "boolean" }, true],
    ["estimateFeedbackRating", { type: "union" }, true],
    ["correctedEstimateMinutes", { type: "number" }, true],
    ["estimateFeedbackSubmittedAt", { type: "number" }, true],
    ["dueDate", { type: "number" }, false],
    ["createdAt", { type: "number" }, false],
    ["courseId", { type: "id", tableName: "userCourses" }, true],
    ["classTag", { type: "string" }, true],
    ["embedding", { type: "array" }, true],
    ["reasoning", { type: "object" }, true],
    ["status", { type: "union" }, false],
    ["assignmentWeight", { type: "number" }, true],
    ["recommendedStart", { type: "number" }, true],
  ],
  subtasks: [
    ["parentTaskId", { type: "id", tableName: "tasks" }, false],
    ["userId", { type: "id", tableName: "users" }, false],
    ["title", { type: "string" }, false],
    ["description", { type: "string" }, false],
    ["taskType", { type: "string" }, false],
    ["color", { type: "string" }, false],
    ["timeEstimate", { type: "number" }, true],
    ["suggestedCompletionAt", { type: "number" }, true],
    ["dueDate", { type: "number" }, true],
    ["courseId", { type: "id", tableName: "userCourses" }, true],
    ["classTag", { type: "string" }, true],
    ["estimateFeedbackRating", { type: "union" }, true],
    ["correctedEstimateMinutes", { type: "number" }, true],
    ["estimateFeedbackSubmittedAt", { type: "number" }, true],
    ["reasoning", { type: "object" }, true],
    ["order", { type: "number" }, false],
    ["createdAt", { type: "number" }, false],
    ["embedding", { type: "array" }, true],
    ["status", { type: "union" }, false],
  ],
  studyBlocks: [
    ["taskId", { type: "id", tableName: "tasks" }, true],
    ["subtaskId", { type: "id", tableName: "subtasks" }, true],
    ["userId", { type: "id", tableName: "users" }, false],
    ["title", { type: "string" }, false],
    ["startTime", { type: "string" }, true],
    ["studyBlockLength", { type: "number" }, false],
    ["isConflicted", { type: "boolean" }, false],
    ["googleEventId", { type: "string" }, true],
    ["needsExport", { type: "boolean" }, true],
    ["isCompleted", { type: "boolean" }, false],
  ],
  chatMessages: [
    ["userId", { type: "id", tableName: "users" }, false],
    ["sessionId", { type: "string" }, false],
    ["role", { type: "union" }, false],
    ["content", { type: "string" }, false],
    ["createdAt", { type: "number" }, false],
    ["clarificationIntent", { type: "union" }, true],
    ["taskId", { type: "id", tableName: "tasks" }, true],
    ["courseId", { type: "id", tableName: "userCourses" }, true],
  ],
  chatSessions: [
    ["userId", { type: "id", tableName: "users" }, false],
    ["sessionId", { type: "string" }, false],
    ["entityClarifyTriggerUserMessageId", { type: "id", tableName: "chatMessages" }, true],
    ["lastEntityQueryText", { type: "string" }, true],
    ["activeEntityStep", { type: "union" }, true],
    ["needsClassAfterTask", { type: "boolean" }, true],
    ["clarificationAttemptCount", { type: "number" }, true],
    ["clarificationExhausted", { type: "boolean" }, true],
    ["awaitingEntityResolution", { type: "boolean" }, true],
    ["chatInputLocked", { type: "boolean" }, true],
    ["activeAgent", { type: "union" }, true],
    ["taskAgentIntent", { type: "union" }, true],
    ["courseAgentIntent", { type: "union" }, true],
    ["activeTaskId", { type: "id", tableName: "tasks" }, true],
    ["activeCourseId", { type: "id", tableName: "userCourses" }, true],
    ["pendingScheduleAction", { type: "literal", value: "schedule_block" }, true],
    ["activeBlockId", { type: "id", tableName: "studyBlocks" }, true],
  ],
  chatChunks: [
    ["userId", { type: "id", tableName: "users" }, false],
    ["sessionId", { type: "string" }, false],
    ["text", { type: "string" }, false],
    ["chunkIndex", { type: "number" }, false],
    ["startCreatedAt", { type: "number" }, false],
    ["linkedTaskIds", { type: "array" }, false],
    ["linkedCourseIds", { type: "array" }, false],
    ["clarificationIntent", { type: "union" }, true],
    ["embedding", { type: "array" }, true],
    ["createdAt", { type: "number" }, false],
  ],
  syllabi: [
    ["userId", { type: "id", tableName: "users" }, false],
    ["fileContents", { type: "string" }, false],
    ["courseId", { type: "id", tableName: "userCourses" }, true],
    ["status", { type: "union" }, false],
    ["createdAt", { type: "number" }, false],
  ],
};

const TABLE_INDEX_SPEC: Record<string, IndexEntry[]> = {
  calendarConnections: [{ indexDescriptor: "by_userId", fields: ["userId"] }],
  calendarOAuthStates: [{ indexDescriptor: "by_state", fields: ["state"] }],
  users: [{ indexDescriptor: "email", fields: ["email"] }],
  userCourses: [
    { indexDescriptor: "by_user", fields: ["userId"] },
    { indexDescriptor: "by_user_course", fields: ["userId", "courseCode"] },
    { indexDescriptor: "by_user_term", fields: ["userId", "term"] },
  ],
  tasks: [
    { indexDescriptor: "by_userId", fields: ["userId"] },
    { indexDescriptor: "by_userId_createdAt", fields: ["userId", "createdAt"] },
    { indexDescriptor: "by_userId_courseId", fields: ["userId", "courseId"] },
  ],
  subtasks: [
    { indexDescriptor: "by_parentTaskId", fields: ["parentTaskId"] },
    { indexDescriptor: "by_userId", fields: ["userId"] },
  ],
  studyBlocks: [
    { indexDescriptor: "by_taskId", fields: ["taskId"] },
    { indexDescriptor: "by_subtaskId", fields: ["subtaskId"] },
    { indexDescriptor: "by_userId", fields: ["userId"] },
    { indexDescriptor: "by_userId_startTime", fields: ["userId", "startTime"] },
  ],
  chatMessages: [
    { indexDescriptor: "by_userId_createdAt", fields: ["userId", "createdAt"] },
    { indexDescriptor: "by_session", fields: ["sessionId"] },
    { indexDescriptor: "by_taskId", fields: ["taskId"] },
    { indexDescriptor: "by_courseId", fields: ["courseId"] },
  ],
  chatSessions: [{ indexDescriptor: "by_userId_sessionId", fields: ["userId", "sessionId"] }],
  chatChunks: [
    { indexDescriptor: "by_userId_sessionId", fields: ["userId", "sessionId"] },
    {
      indexDescriptor: "by_userId_sessionId_chunkIndex",
      fields: ["userId", "sessionId", "chunkIndex"],
    },
  ],
  syllabi: [
    { indexDescriptor: "by_userId", fields: ["userId"] },
    { indexDescriptor: "by_courseId", fields: ["courseId"] },
  ],
};

const TABLE_VECTOR_INDEX_SPEC: Record<string, VectorIndexEntry[]> = {
  userCourses: [
    {
      indexDescriptor: "by_embedding",
      vectorField: "embedding",
      dimensions: 3072,
      filterFields: ["userId"],
    },
  ],
  tasks: [
    {
      indexDescriptor: "by_embedding",
      vectorField: "embedding",
      dimensions: 3072,
      filterFields: ["userId"],
    },
  ],
  subtasks: [
    {
      indexDescriptor: "by_embedding",
      vectorField: "embedding",
      dimensions: 3072,
      filterFields: ["userId"],
    },
  ],
  chatChunks: [
    {
      indexDescriptor: "by_embedding",
      vectorField: "embedding",
      dimensions: 3072,
      filterFields: ["userId"],
    },
  ],
};

describe("schema – tables exist", () => {
  for (const tableName of Object.keys(TABLE_FIELD_SPEC)) {
    test(`table "${tableName}" is defined`, () => {
      expect(
        tablesByName.has(tableName),
        `Expected table "${tableName}" to exist in schema.ts`
      ).toBe(true);
    });
  }

  test("schemaValidation is enabled", () => {
    expect(exported.schemaValidation).toBe(true);
  });
});

describe("schema – field shape per table", () => {
  for (const [tableName, fields] of Object.entries(TABLE_FIELD_SPEC)) {
    describe(tableName, () => {
      const expectedFieldNames = new Set(fields.map(([name]) => name));

      test("has exactly the expected fields", () => {
        const actualFieldNames = new Set(Object.keys(getTable(tableName).documentType.value));
        const missing = [...expectedFieldNames].filter((n) => !actualFieldNames.has(n));
        const extra = [...actualFieldNames].filter((n) => !expectedFieldNames.has(n));
        expect(missing, `Table "${tableName}" is missing expected fields`).toEqual([]);
        expect(
          extra,
          `Table "${tableName}" has unexpected fields not covered by the schema test`
        ).toEqual([]);
      });

      for (const [fieldName, expectedType, optional] of fields) {
        test(`field "${fieldName}" matches validator and optionality`, () => {
          const field = getField(tableName, fieldName);
          expect(field.optional, `Expected ${tableName}.${fieldName} optional=${optional}`).toBe(
            optional
          );
          expect(
            field.fieldType,
            `Expected ${tableName}.${fieldName} validator type`
          ).toMatchObject(expectedType);
        });
      }
    });
  }
});

describe("schema – validator-level constraints (unions / literals / ids)", () => {
  test("tasks.estimateFeedbackRating is union of literals 'up' | 'down'", () => {
    const field = getField("tasks", "estimateFeedbackRating");
    expect(field.fieldType.type).toBe("union");
    const members = (field.fieldType as Extract<FieldType, { type: "union" }>).value;
    const literals = members.map((m) => (m.type === "literal" ? m.value : m.type));
    expect(new Set(literals)).toEqual(new Set(["up", "down"]));
  });

  test("tasks.status is union of 'not_started' | 'in_progress' | 'completed'", () => {
    const field = getField("tasks", "status");
    expect(field.fieldType.type).toBe("union");
    const members = (field.fieldType as Extract<FieldType, { type: "union" }>).value;
    const literals = members.map((m) => (m.type === "literal" ? m.value : m.type));
    expect(new Set(literals)).toEqual(new Set(["not_started", "in_progress", "completed"]));
  });

  test("subtasks.status mirrors tasks.status union", () => {
    const field = getField("subtasks", "status");
    expect(field.fieldType.type).toBe("union");
    const members = (field.fieldType as Extract<FieldType, { type: "union" }>).value;
    const literals = members.map((m) => (m.type === "literal" ? m.value : m.type));
    expect(new Set(literals)).toEqual(new Set(["not_started", "in_progress", "completed"]));
  });

  test("chatMessages.role is union of 'user' | 'assistant'", () => {
    const field = getField("chatMessages", "role");
    expect(field.fieldType.type).toBe("union");
    const members = (field.fieldType as Extract<FieldType, { type: "union" }>).value;
    expect(
      new Set(members.map((m) => (m as Extract<FieldType, { value: unknown }>).value))
    ).toEqual(new Set(["user", "assistant"]));
  });

  test("chatMessages.clarificationIntent allows the three documented values", () => {
    const field = getField("chatMessages", "clarificationIntent");
    expect(field.fieldType.type).toBe("union");
    const members = (field.fieldType as Extract<FieldType, { type: "union" }>).value;
    expect(
      new Set(members.map((m) => (m as Extract<FieldType, { value: unknown }>).value))
    ).toEqual(new Set(["task_feedback", "class_difficulty", "none"]));
  });

  test("chatSessions.activeEntityStep is union of 'task' | 'class'", () => {
    const field = getField("chatSessions", "activeEntityStep");
    expect(field.fieldType.type).toBe("union");
    const members = (field.fieldType as Extract<FieldType, { type: "union" }>).value;
    expect(
      new Set(members.map((m) => (m as Extract<FieldType, { value: unknown }>).value))
    ).toEqual(new Set(["task", "class"]));
  });

  test("chatSessions.activeAgent covers every specialist agent", () => {
    const field = getField("chatSessions", "activeAgent");
    expect(field.fieldType.type).toBe("union");
    const members = (field.fieldType as Extract<FieldType, { type: "union" }>).value;
    expect(
      new Set(members.map((m) => (m as Extract<FieldType, { value: unknown }>).value))
    ).toEqual(new Set(["task", "feedback", "preferences", "classes", "schedule"]));
  });

  test("chatSessions.taskAgentIntent is 'create' | 'rud'", () => {
    const field = getField("chatSessions", "taskAgentIntent");
    expect(field.fieldType.type).toBe("union");
    const members = (field.fieldType as Extract<FieldType, { type: "union" }>).value;
    expect(
      new Set(members.map((m) => (m as Extract<FieldType, { value: unknown }>).value))
    ).toEqual(new Set(["create", "rud"]));
  });

  test("chatSessions.courseAgentIntent covers add/drop/view/update", () => {
    const field = getField("chatSessions", "courseAgentIntent");
    expect(field.fieldType.type).toBe("union");
    const members = (field.fieldType as Extract<FieldType, { type: "union" }>).value;
    expect(
      new Set(members.map((m) => (m as Extract<FieldType, { value: unknown }>).value))
    ).toEqual(new Set(["add", "drop", "view", "update"]));
  });

  test("chatSessions.pendingScheduleAction is the literal 'schedule_block'", () => {
    const field = getField("chatSessions", "pendingScheduleAction");
    expect(field.fieldType).toEqual({
      type: "literal",
      value: "schedule_block",
    });
  });

  test("syllabi.status is union of 'pending' | 'confirmed' | 'failed'", () => {
    const field = getField("syllabi", "status");
    expect(field.fieldType.type).toBe("union");
    const members = (field.fieldType as Extract<FieldType, { type: "union" }>).value;
    expect(
      new Set(members.map((m) => (m as Extract<FieldType, { value: unknown }>).value))
    ).toEqual(new Set(["pending", "confirmed", "failed"]));
  });

  test("studyBlocks references both taskId and subtaskId by id", () => {
    expect(getField("studyBlocks", "taskId").fieldType).toEqual({
      type: "id",
      tableName: "tasks",
    });
    expect(getField("studyBlocks", "subtaskId").fieldType).toEqual({
      type: "id",
      tableName: "subtasks",
    });
  });

  test("subtasks.parentTaskId references tasks", () => {
    expect(getField("subtasks", "parentTaskId").fieldType).toEqual({
      type: "id",
      tableName: "tasks",
    });
  });

  test("tasks.reasoning is an object with all four reasoning categories", () => {
    const field = getField("tasks", "reasoning");
    expect(field.fieldType.type).toBe("object");
    const obj = field.fieldType as Extract<FieldType, { type: "object" }>;
    expect(new Set(Object.keys(obj.value))).toEqual(
      new Set(["classes", "tasks", "chats", "profile"])
    );
    for (const key of ["classes", "tasks", "chats", "profile"]) {
      expect(obj.value[key].fieldType).toEqual({ type: "string" });
      expect(obj.value[key].optional).toBe(false);
    }
  });

  test("users.year covers Freshman/Sophomore/Junior/Senior/Graduate", () => {
    const field = getField("users", "year");
    expect(field.fieldType.type).toBe("union");
    const members = (field.fieldType as Extract<FieldType, { type: "union" }>).value;
    expect(
      new Set(members.map((m) => (m as Extract<FieldType, { value: unknown }>).value))
    ).toEqual(new Set(["Freshman", "Sophomore", "Junior", "Senior", "Graduate"]));
  });

  test("users.productivityTraits is an object of optional string-array fields", () => {
    const field = getField("users", "productivityTraits");
    expect(field.fieldType.type).toBe("object");
    const obj = field.fieldType as Extract<FieldType, { type: "object" }>;
    expect(new Set(Object.keys(obj.value))).toEqual(
      new Set(["timeOfDay", "dayOfWeek", "workSessionStyle", "deadlineBehavior"])
    );
    for (const key of Object.keys(obj.value)) {
      expect(obj.value[key].optional, `${key} should be optional`).toBe(true);
      expect(obj.value[key].fieldType.type).toBe("array");
    }
  });

  test("users.workHoursGrid is array<{day: DayOfWeek union, blocked: number[]}>", () => {
    const field = getField("users", "workHoursGrid");
    expect(field.fieldType.type).toBe("array");
    const arr = field.fieldType as Extract<FieldType, { type: "array" }>;
    expect(arr.value.type).toBe("object");
    const elemFields = (arr.value as Extract<FieldType, { type: "object" }>).value;
    expect(new Set(Object.keys(elemFields))).toEqual(new Set(["day", "blocked"]));
    expect(elemFields.day.fieldType.type).toBe("union");
    const dayMembers = (elemFields.day.fieldType as Extract<FieldType, { type: "union" }>).value;
    expect(
      new Set(dayMembers.map((m) => (m as Extract<FieldType, { value: unknown }>).value))
    ).toEqual(
      new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
    );
    expect(elemFields.blocked.fieldType.type).toBe("array");
  });

  test("chatChunks.linkedTaskIds and linkedCourseIds are id-typed arrays", () => {
    const tasksField = getField("chatChunks", "linkedTaskIds");
    expect(tasksField.fieldType).toEqual({
      type: "array",
      value: { type: "id", tableName: "tasks" },
    });
    const coursesField = getField("chatChunks", "linkedCourseIds");
    expect(coursesField.fieldType).toEqual({
      type: "array",
      value: { type: "id", tableName: "userCourses" },
    });
  });
});

describe("schema – indexes", () => {
  for (const [tableName, expectedIndexes] of Object.entries(TABLE_INDEX_SPEC)) {
    describe(tableName, () => {
      const expectedNames = new Set(expectedIndexes.map((i) => i.indexDescriptor));

      test("has exactly the expected indexes", () => {
        const table = getTable(tableName);
        const actualNames = new Set(table.indexes.map((i) => i.indexDescriptor));
        const missing = [...expectedNames].filter((n) => !actualNames.has(n));
        const extra = [...actualNames].filter((n) => !expectedNames.has(n));
        expect(missing, `Table "${tableName}" is missing indexes`).toEqual([]);
        expect(
          extra,
          `Table "${tableName}" has unexpected indexes not covered by the schema test`
        ).toEqual([]);
      });

      for (const expectedIndex of expectedIndexes) {
        test(`index "${expectedIndex.indexDescriptor}" has fields ${expectedIndex.fields.join(",")}`, () => {
          const table = getTable(tableName);
          const actual = table.indexes.find(
            (i) => i.indexDescriptor === expectedIndex.indexDescriptor
          );
          expect(actual, `Missing index ${expectedIndex.indexDescriptor}`).toBeDefined();
          expect(actual!.fields).toEqual(expectedIndex.fields);
        });
      }
    });
  }
});

describe("schema – vector indexes", () => {
  for (const [tableName, expectedIndexes] of Object.entries(TABLE_VECTOR_INDEX_SPEC)) {
    describe(tableName, () => {
      for (const expected of expectedIndexes) {
        test(`vector index "${expected.indexDescriptor}" matches expected shape`, () => {
          const table = getTable(tableName);
          const actual = table.vectorIndexes.find(
            (i) => i.indexDescriptor === expected.indexDescriptor
          );
          expect(
            actual,
            `Missing vector index ${expected.indexDescriptor} on ${tableName}`
          ).toBeDefined();
          expect(actual!.vectorField).toBe(expected.vectorField);
          expect(actual!.dimensions).toBe(expected.dimensions);
          expect(actual!.filterFields).toEqual(expected.filterFields);
        });
      }
    });
  }

  test("tables without vector indexes have none", () => {
    const tablesWithVectorIndexes = new Set(Object.keys(TABLE_VECTOR_INDEX_SPEC));
    for (const tableName of Object.keys(TABLE_FIELD_SPEC)) {
      if (tablesWithVectorIndexes.has(tableName)) continue;
      expect(
        getTable(tableName).vectorIndexes,
        `Table "${tableName}" should not declare vector indexes`
      ).toEqual([]);
    }
  });
});

describe("schema – runtime insert validation", () => {
  test("inserting a task missing the required `title` field is rejected", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await expect(
      t.run((ctx) =>
        ctx.db.insert("tasks", {
          userId,
          // title intentionally omitted
          description: "desc",
          taskType: "Essay",
          dueDate: Date.now() + 86_400_000,
          createdAt: Date.now(),
          status: "not_started",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      )
    ).rejects.toThrow();
  });

  test("inserting a task missing the required `dueDate` field is rejected", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await expect(
      t.run((ctx) =>
        ctx.db.insert("tasks", {
          userId,
          title: "T",
          description: "desc",
          taskType: "Essay",
          // dueDate intentionally omitted
          createdAt: Date.now(),
          status: "not_started",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      )
    ).rejects.toThrow();
  });

  test("inserting a task missing the required `status` field is rejected", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await expect(
      t.run((ctx) =>
        ctx.db.insert("tasks", {
          userId,
          title: "T",
          description: "desc",
          taskType: "Essay",
          dueDate: Date.now() + 86_400_000,
          createdAt: Date.now(),
          // status intentionally omitted
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      )
    ).rejects.toThrow();
  });

  test("inserting a task with an unknown extra field is rejected", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await expect(
      t.run((ctx) =>
        ctx.db.insert("tasks", {
          userId,
          title: "T",
          description: "desc",
          taskType: "Essay",
          dueDate: Date.now() + 86_400_000,
          createdAt: Date.now(),
          status: "not_started",
          someBogusField: "nope",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      )
    ).rejects.toThrow();
  });

  test("inserting a task with a wrong-type field is rejected", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await expect(
      t.run((ctx) =>
        ctx.db.insert("tasks", {
          userId,
          title: "T",
          description: "desc",
          taskType: "Essay",
          // dueDate must be number, not string
          dueDate: "tomorrow" as unknown as number,
          createdAt: Date.now(),
          status: "not_started",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      )
    ).rejects.toThrow();
  });

  test("inserting a task with a status outside the allowed union is rejected", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    await expect(
      t.run((ctx) =>
        ctx.db.insert("tasks", {
          userId,
          title: "T",
          description: "desc",
          taskType: "Essay",
          dueDate: Date.now() + 86_400_000,
          createdAt: Date.now(),
          status: "archived",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      )
    ).rejects.toThrow();
  });

  test("inserting a fully-valid task succeeds", async () => {
    const t = makeTestCtx();
    const { userId } = await createTestUser(t);

    const taskId = await t.run((ctx) =>
      ctx.db.insert("tasks", {
        userId,
        title: "Valid task",
        description: "desc",
        taskType: "Essay",
        dueDate: Date.now() + 86_400_000,
        createdAt: Date.now(),
        status: "not_started",
      })
    );

    const stored = await t.run((ctx) => ctx.db.get(taskId));
    expect(stored?.title).toBe("Valid task");
    expect(stored?.status).toBe("not_started");
  });
});
