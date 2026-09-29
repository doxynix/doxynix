import { describe, expect, it } from "vitest";

import { buildSpec } from "./field-encryption-generator";

const dmmf = {
  datamodel: {
    models: [
      {
        fields: [
          {
            documentation: "/// @encrypted",
            isId: false,
            isList: false,
            isUnique: false,
            name: "email",
            type: "String",
          },
          {
            documentation: "/// @encryption:hash(email)?normalize=lowercase&normalize=trim",
            isId: false,
            isList: false,
            isUnique: true,
            name: "emailHash",
            type: "String",
          },
          {
            documentation: null,
            isId: true,
            isList: false,
            isUnique: false,
            name: "id",
            type: "String",
          },
          {
            documentation: null,
            isId: false,
            isList: true,
            isUnique: false,
            name: "accounts",
            type: "Account",
          },
        ],
        name: "User",
      },
      {
        fields: [
          {
            documentation: "/// @encrypted",
            isId: false,
            isList: false,
            isUnique: false,
            name: "accessToken",
            type: "String",
          },
          {
            documentation: null,
            isId: true,
            isList: false,
            isUnique: false,
            name: "id",
            type: "String",
          },
        ],
        name: "Account",
      },
      {
        fields: [
          {
            documentation: null,
            isId: true,
            isList: false,
            isUnique: false,
            name: "id",
            type: "String",
          },
        ],
        name: "Repo",
      },
    ],
  },
} as never;

describe("field-encryption-generator", () => {
  const spec = buildSpec(dmmf);

  it("collects @encrypted fields", () => {
    expect(spec.User?.fields.email).toBeDefined();
    expect(spec.Account?.fields.accessToken).toEqual({});
  });

  it("attaches hash metadata to the source field, not the hash field", () => {
    expect(spec.User?.fields.email).toEqual({ hash: { normalize: ["lowercase", "trim"] } });
    expect(spec.User?.fields.emailHash).toBeUndefined();
  });

  it("maps relations to the target model name", () => {
    expect(spec.User?.connections).toEqual({ accounts: "Account" });
  });

  it("omits models with nothing encrypted and no relations", () => {
    expect(spec.Repo).toBeUndefined();
  });

  it("includes a model that only has relations when it is otherwise untouched", () => {
    expect(Object.keys(spec).sort()).toEqual(["Account", "User"]);
  });
});
