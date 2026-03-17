import { inArray } from "@/lib/utils";

const getOperators = (type) => {
  let operators = {};
  switch (type) {
    case "string":
      operators = {
        "=": {
          operator: "=",
          searchType: type,
        },
        "!=": {
          operator: "!=",
          searchType: type,
        },
        matches: {
          operator: "matches",
          searchType: type,
        },
        not_matches: {
          operator: "not_matches",
          searchType: type,
        },
        in: {
          operator: "in",
          searchType: `multiple:${type}`,
        },
        not_in: {
          operator: "!in",
          searchType: `multiple:${type}`,
        },
      };
      break;
    case "number":
    case "currency":
    case "date":
    case "datetime":
      operators = {
        "=": {
          operator: "=",
          searchType: inArray(type, ["date", "datetime"]) ? "date" : type,
        },
        "!=": {
          operator: "!=",
          searchType: inArray(type, ["date", "datetime"]) ? "date" : type,
        },
        ">": {
          operator: ">",
          searchType: inArray(type, ["date", "datetime"]) ? "date" : type,
        },
        "<": {
          operator: "<",
          searchType: inArray(type, ["date", "datetime"]) ? "date" : type,
        },
        ">=": {
          operator: ">=",
          searchType: inArray(type, ["date", "datetime"]) ? "date" : type,
        },
        "<=": {
          operator: "<=",
          searchType: inArray(type, ["date", "datetime"]) ? "date" : type,
        },
        in: {
          operator: "in",
          searchType: `multiple:${type}`,
        },
        not_in: {
          operator: "!in",
          searchType: `multiple:${type}`,
        },
        between: {
          operator: "between",
          searchType: inArray(type, ["date", "datetime"])
            ? "dateSelector"
            : type,
        },
        not_between: {
          operator: "not_between",
          searchType: inArray(type, ["date", "datetime"])
            ? "dateSelector"
            : type,
        },
      };
      break;
    case "formStatus":
    case "relation":
      operators = {
        "=": {
          operator: "=",
          searchType: type,
        },
        "!=": {
          operator: "!=",
          searchType: type,
        },
        in: {
          operator: "in",
          searchType: `multiple:${type}`,
        },
        not_in: {
          operator: "!in",
          searchType: `multiple:${type}`,
        },
      };
      break;
    case "formStatuses":
    case "relations":
      operators = {
        has: {
          operator: "has",
          searchType: type,
        },
        not_has: {
          operator: "not_has",
          searchType: type,
        },
        in: {
          operator: "in",
          searchType: `multiple:${type}`,
        },
        not_in: {
          operator: "!in",
          searchType: `multiple:${type}`,
        },
      };
      break;
    case "boolean":
      operators = {
        "=": {
          operator: "=",
          searchType: type,
        },
        "!=": {
          operator: "!=",
          searchType: type,
        },
      };
      break;
    default:
      operators = {};
  }

  return {
    ...operators,
    set: {
      operator: "set",
    },
    not_set: {
      operator: "not_set",
    },
  };
};

export { getOperators };
