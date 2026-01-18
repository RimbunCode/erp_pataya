import Handlebars from "handlebars";
import { c as convertTemplateLink } from "./checkbox-C_BEU5E4.js";
function initHandlebar(trans) {
  Handlebars.registerHelper("relation", function(payload) {
    return convertTemplateLink(payload);
  });
  Handlebars.registerHelper("trans", function(payload, options) {
    var _a, _b, _c, _d;
    if (typeof payload !== "string") {
      return (payload == null ? void 0 : payload.title) || trans(payload == null ? void 0 : payload.titleTrans) || (payload == null ? void 0 : payload.name);
    }
    const keys = payload.split(".");
    if (keys[0] == "document") {
      let document = (_b = (_a = options == null ? void 0 : options.data) == null ? void 0 : _a.root) == null ? void 0 : _b.document;
      console.log(document);
      const key = keys[1];
      document = document == null ? void 0 : document.find((x) => x.name == key);
      return (document == null ? void 0 : document.title) || trans(document == null ? void 0 : document.titleTrans) || (document == null ? void 0 : document.name);
    }
    let data = (_c = options == null ? void 0 : options.data) == null ? void 0 : _c.root.dataTableColumns;
    const type = options.hash.type ?? "data";
    data = (_d = data == null ? void 0 : data.filter(
      (x) => x.type == (type == "companyDetail" ? "preferences" : type)
    )[0]) == null ? void 0 : _d.columns;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      data = data == null ? void 0 : data.filter((x) => x.name == key)[0];
      if (i == keys.length - 1) {
        return (data == null ? void 0 : data.title) || trans(data == null ? void 0 : data.titleTrans) || (data == null ? void 0 : data.name);
      }
      if (data) {
        data = data == null ? void 0 : data.columns;
      }
    }
  });
  Handlebars.registerHelper("companyDetail", function(key, options) {
    var _a, _b;
    const data = (_b = (_a = options == null ? void 0 : options.data) == null ? void 0 : _a.root) == null ? void 0 : _b.preferences;
    return data[key];
  });
  Handlebars.registerHelper("each", function(context, options) {
    if (!context) return options.fn(context);
    var ret = "";
    for (var i = 0, j = context.length; i < j; i++) {
      context[i].idx = i + 1;
      ret = ret + options.fn(context[i]);
    }
    return ret;
  });
  Handlebars.registerHelper("infoColumns", function(context, options) {
    var _a, _b;
    if (!context) return options.fn(context);
    const type = options.hash.type ?? "data";
    const oriKey = options.hash.key ?? "";
    const splitKey = oriKey.split(".");
    let data = (_a = context == null ? void 0 : context.filter((x) => x.type == type)[0]) == null ? void 0 : _a.columns;
    for (let key of splitKey) {
      const temp = (_b = data == null ? void 0 : data.filter((x) => x.name == key)[0]) == null ? void 0 : _b.columns;
      if (temp) {
        data = temp;
      }
    }
    data = data == null ? void 0 : data.reduce(
      (a, b) => ({
        ...a,
        [b.name]: options.hash.extract ? b[options.hash.extract] : b
      }),
      {}
    );
    return options.fn(data);
  });
}
export {
  initHandlebar as i
};
