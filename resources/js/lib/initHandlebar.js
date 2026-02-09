import Handlebars from "handlebars";
import { convertTemplateLink } from "./linkModelUtils";

export function initHandlebar(trans) {
  Handlebars.registerHelper("relation", function (payload) {
    return convertTemplateLink(payload);
  });
  // function getValue()
  Handlebars.registerHelper("trans", function (payload, options) {
    if (typeof payload !== "string") {
      return payload?.title || trans(payload?.titleTrans) || payload?.name;
    }
    const keys = payload.split(".");

    if (keys[0] == "document") {
      let document = options?.data?.root?.document;
      console.log(document);
      const key = keys[1];
      document = document?.find((x) => x.name == key);
      return document?.title || trans(document?.titleTrans) || document?.name;
    }

    let data = options?.data?.root.dataTableColumns;
    const type = options.hash.type ?? "data";

    data = data?.filter(
      (x) => x.type == (type == "companyDetail" ? "preferences" : type),
    )[0]?.columns;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      data = data?.filter((x) => x.name == key)[0];
      if (i == keys.length - 1) {
        return data?.title || trans(data?.titleTrans) || data?.name;
      }
      if (data) {
        data = data?.columns;
      }
    }
  });
  Handlebars.registerHelper("companyDetail", function (key, options) {
    const data = options?.data?.root?.preferences;
    return data[key];
  });
  Handlebars.registerHelper("each", function (context, options) {
    if (!context) return options.fn(context);
    var ret = "";
    for (var i = 0, j = context.length; i < j; i++) {
      context[i].idx = i + 1;
      ret = ret + options.fn(context[i]);
    }

    return ret;
  });
  Handlebars.registerHelper("infoColumns", function (context, options) {
    if (!context) return options.fn(context);
    const type = options.hash.type ?? "data";
    const oriKey = options.hash.key ?? "";
    const splitKey = oriKey.split(".");

    let data = context?.filter((x) => x.type == type)[0]?.columns;

    for (let key of splitKey) {
      const temp = data?.filter((x) => x.name == key)[0]?.columns;
      if (temp) {
        data = temp;
      }
    }
    data = data?.reduce(
      (a, b) => ({
        ...a,
        [b.name]: options.hash.extract ? b[options.hash.extract] : b,
      }),
      {},
    );
    return options.fn(data);
  });
}
