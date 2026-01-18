import { jsx } from "react/jsx-runtime";
import React__default, { forwardRef, useMemo, useState, useRef, useImperativeHandle, useEffect } from "react";
import { c as cn } from "./utils-ClCZGsDL.js";
import { b as useDidMountEffect } from "./Link-p0Z4AKax.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
var __assign = function() {
  __assign = Object.assign || function __assign2(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
      s = arguments[i];
      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
    }
    return t;
  };
  return __assign.apply(this, arguments);
};
function __rest(s, e) {
  var t = {};
  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    t[p] = s[p];
  if (s != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        t[p[i]] = s[p[i]];
    }
  return t;
}
function __spreadArray(to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
}
typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
  var e = new Error(message);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};
var escapeRegExp = function(stringToGoIntoTheRegex) {
  return stringToGoIntoTheRegex.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
};
var abbrMap = { k: 1e3, m: 1e6, b: 1e9 };
var parseAbbrValue = function(value, decimalSeparator) {
  if (decimalSeparator === void 0) {
    decimalSeparator = ".";
  }
  var reg = new RegExp("(\\d+(".concat(escapeRegExp(decimalSeparator), "\\d*)?)([kmb])$"), "i");
  var match = value.match(reg);
  if (match) {
    var digits = match[1], abbr = match[3];
    var multiplier = abbrMap[abbr.toLowerCase()];
    return Number(digits.replace(decimalSeparator, ".")) * multiplier;
  }
  return void 0;
};
var removeSeparators = function(value, separator) {
  if (separator === void 0) {
    separator = ",";
  }
  var reg = new RegExp(escapeRegExp(separator), "g");
  return value.replace(reg, "");
};
var removeInvalidChars = function(value, validChars) {
  var chars = escapeRegExp(validChars.join(""));
  var reg = new RegExp("[^\\d".concat(chars, "]"), "gi");
  return value.replace(reg, "");
};
var cleanValue = function(_a) {
  var value = _a.value, _b = _a.groupSeparator, groupSeparator = _b === void 0 ? "," : _b, _c = _a.decimalSeparator, decimalSeparator = _c === void 0 ? "." : _c, _d = _a.allowDecimals, allowDecimals = _d === void 0 ? true : _d, _e = _a.decimalsLimit, decimalsLimit = _e === void 0 ? 2 : _e, _f = _a.allowNegativeValue, allowNegativeValue = _f === void 0 ? true : _f, _g = _a.disableAbbreviations, disableAbbreviations = _g === void 0 ? false : _g, _h = _a.prefix, prefix = _h === void 0 ? "" : _h, _j = _a.transformRawValue, transformRawValue = _j === void 0 ? function(rawValue) {
    return rawValue;
  } : _j;
  var transformedValue = transformRawValue(value);
  if (transformedValue === "-") {
    return transformedValue;
  }
  var abbreviations = disableAbbreviations ? [] : ["k", "m", "b"];
  var reg = new RegExp("((^|\\D)-\\d)|(-".concat(escapeRegExp(prefix), ")"));
  var isNegative = reg.test(transformedValue);
  var _k = RegExp("(\\d+)-?".concat(escapeRegExp(prefix))).exec(value) || [], prefixWithValue = _k[0], preValue = _k[1];
  var withoutPrefix = prefix ? prefixWithValue ? transformedValue.replace(prefixWithValue, "").concat(preValue) : transformedValue.replace(prefix, "") : transformedValue;
  var withoutSeparators = removeSeparators(withoutPrefix, groupSeparator);
  var withoutInvalidChars = removeInvalidChars(withoutSeparators, __spreadArray([
    groupSeparator,
    decimalSeparator
  ], abbreviations, true));
  var valueOnly = withoutInvalidChars;
  if (!disableAbbreviations) {
    if (abbreviations.some(function(letter) {
      return letter === withoutInvalidChars.toLowerCase().replace(decimalSeparator, "");
    })) {
      return "";
    }
    var parsed = parseAbbrValue(withoutInvalidChars, decimalSeparator);
    if (parsed) {
      valueOnly = String(parsed);
    }
  }
  var includeNegative = isNegative && allowNegativeValue ? "-" : "";
  if (decimalSeparator && valueOnly.includes(decimalSeparator)) {
    var _l = withoutInvalidChars.split(decimalSeparator), int = _l[0], decimals = _l[1];
    var trimmedDecimals = decimalsLimit && decimals ? decimals.slice(0, decimalsLimit) : decimals;
    var includeDecimals = allowDecimals ? "".concat(decimalSeparator).concat(trimmedDecimals) : "";
    return "".concat(includeNegative).concat(int).concat(includeDecimals);
  }
  return "".concat(includeNegative).concat(valueOnly);
};
var fixedDecimalValue = function(value, decimalSeparator, fixedDecimalLength) {
  if (fixedDecimalLength !== void 0 && value.length > 1) {
    if (fixedDecimalLength === 0) {
      return value.replace(decimalSeparator, "");
    }
    if (value.includes(decimalSeparator)) {
      var _a = value.split(decimalSeparator), int = _a[0], decimals = _a[1];
      if (decimals.length === fixedDecimalLength) {
        return value;
      }
      if (decimals.length > fixedDecimalLength) {
        return "".concat(int).concat(decimalSeparator).concat(decimals.slice(0, fixedDecimalLength));
      }
    }
    var reg = value.length > fixedDecimalLength ? new RegExp("(\\d+)(\\d{".concat(fixedDecimalLength, "})")) : new RegExp("(\\d)(\\d+)");
    var match = value.match(reg);
    if (match) {
      var int = match[1], decimals = match[2];
      return "".concat(int).concat(decimalSeparator).concat(decimals);
    }
  }
  return value;
};
var defaultConfig = {
  currencySymbol: "",
  groupSeparator: "",
  decimalSeparator: "",
  prefix: "",
  suffix: ""
};
var getLocaleConfig = function(intlConfig) {
  var _a = intlConfig || {}, locale = _a.locale, currency = _a.currency, formatOptions = __rest(_a, ["locale", "currency"]);
  var numberFormatter = locale ? new Intl.NumberFormat(locale, __assign(__assign({}, formatOptions), currency && { currency, style: "currency" })) : new Intl.NumberFormat();
  return numberFormatter.formatToParts(1000.1).reduce(function(prev, curr, i) {
    if (curr.type === "currency") {
      if (i === 0) {
        return __assign(__assign({}, prev), { currencySymbol: curr.value, prefix: curr.value });
      } else {
        return __assign(__assign({}, prev), { currencySymbol: curr.value, suffix: curr.value });
      }
    }
    if (curr.type === "group") {
      return __assign(__assign({}, prev), { groupSeparator: curr.value });
    }
    if (curr.type === "decimal") {
      return __assign(__assign({}, prev), { decimalSeparator: curr.value });
    }
    return prev;
  }, defaultConfig);
};
var getSuffix = function(value, _a) {
  var _b = _a.groupSeparator, groupSeparator = _b === void 0 ? "," : _b, _c = _a.decimalSeparator, decimalSeparator = _c === void 0 ? "." : _c;
  var suffixReg = new RegExp("\\d([^".concat(escapeRegExp(groupSeparator)).concat(escapeRegExp(decimalSeparator), "0-9]+)"));
  var suffixMatch = value.match(suffixReg);
  return suffixMatch ? suffixMatch[1] : void 0;
};
var formatValue$1 = function(options) {
  var _value = options.value, _decimalSeparator = options.decimalSeparator, intlConfig = options.intlConfig, decimalScale = options.decimalScale, _a = options.prefix, prefix = _a === void 0 ? "" : _a, _b = options.suffix, suffix = _b === void 0 ? "" : _b;
  if (_value === "" || _value === void 0) {
    return "";
  }
  if (_value === "-") {
    return "-";
  }
  var isNegative = new RegExp("^\\d?-".concat(prefix ? "".concat(escapeRegExp(prefix), "?") : "", "\\d")).test(_value);
  var _c = intlConfig || {}, locale = _c.locale, currency = _c.currency, formatOptions = __rest(_c, ["locale", "currency"]);
  var localeConfig = getLocaleConfig(intlConfig);
  var decimalSeparator = _decimalSeparator || localeConfig.decimalSeparator || ".";
  var value = decimalSeparator !== "." ? replaceDecimalSeparator(_value, decimalSeparator, isNegative) : _value;
  if (decimalSeparator !== "-" && value.startsWith(decimalSeparator)) {
    value = "0" + value;
  }
  var defaultNumberFormatOptions = __assign(__assign({}, formatOptions), { minimumFractionDigits: decimalScale || 0, maximumFractionDigits: decimalScale || 20 });
  var numberFormatter = intlConfig ? new Intl.NumberFormat(locale, __assign(__assign({}, defaultNumberFormatOptions), currency && { style: "currency", currency })) : new Intl.NumberFormat(void 0, defaultNumberFormatOptions);
  var parts = numberFormatter.formatToParts(Number(value));
  var formatted = replaceParts(parts, options);
  var intlSuffix = getSuffix(formatted, __assign({}, options));
  var includeDecimalSeparator = _value.slice(-1) === decimalSeparator ? decimalSeparator : "";
  var _d = value.match(RegExp("\\d+\\.(\\d+)")) || [], decimals = _d[1];
  if (decimalScale === void 0 && decimals && decimalSeparator) {
    if (formatted.includes(decimalSeparator)) {
      formatted = formatted.replace(RegExp("(\\d+)(".concat(escapeRegExp(decimalSeparator), ")(\\d+)"), "g"), "$1$2".concat(decimals));
    } else {
      if (intlSuffix && !suffix) {
        formatted = formatted.replace(intlSuffix, "".concat(decimalSeparator).concat(decimals).concat(intlSuffix));
      } else {
        formatted = "".concat(formatted).concat(decimalSeparator).concat(decimals);
      }
    }
  }
  if (suffix && includeDecimalSeparator) {
    return "".concat(formatted).concat(includeDecimalSeparator).concat(suffix);
  }
  if (intlSuffix && includeDecimalSeparator) {
    return formatted.replace(intlSuffix, "".concat(includeDecimalSeparator).concat(intlSuffix));
  }
  if (intlSuffix && suffix) {
    return formatted.replace(intlSuffix, "".concat(includeDecimalSeparator).concat(suffix));
  }
  return [formatted, includeDecimalSeparator, suffix].join("");
};
var replaceDecimalSeparator = function(value, decimalSeparator, isNegative) {
  var newValue = value;
  if (decimalSeparator !== ".") {
    newValue = newValue.replace(RegExp(escapeRegExp(decimalSeparator), "g"), ".");
    if (isNegative && decimalSeparator === "-") {
      newValue = "-".concat(newValue.slice(1));
    }
  }
  return newValue;
};
var replaceParts = function(parts, _a) {
  var prefix = _a.prefix, groupSeparator = _a.groupSeparator, decimalSeparator = _a.decimalSeparator, decimalScale = _a.decimalScale, _b = _a.disableGroupSeparators, disableGroupSeparators = _b === void 0 ? false : _b;
  return parts.reduce(function(prev, _a2, i) {
    var type = _a2.type, value = _a2.value;
    if (i === 0 && prefix) {
      if (type === "minusSign") {
        return [value, prefix];
      }
      if (type === "currency") {
        return __spreadArray(__spreadArray([], prev, true), [prefix], false);
      }
      return [prefix, value];
    }
    if (type === "currency") {
      return prefix ? prev : __spreadArray(__spreadArray([], prev, true), [value], false);
    }
    if (type === "group") {
      return !disableGroupSeparators ? __spreadArray(__spreadArray([], prev, true), [groupSeparator !== void 0 ? groupSeparator : value], false) : prev;
    }
    if (type === "decimal") {
      if (decimalScale !== void 0 && decimalScale === 0) {
        return prev;
      }
      return __spreadArray(__spreadArray([], prev, true), [decimalSeparator !== void 0 ? decimalSeparator : value], false);
    }
    if (type === "fraction") {
      return __spreadArray(__spreadArray([], prev, true), [decimalScale !== void 0 ? value.slice(0, decimalScale) : value], false);
    }
    return __spreadArray(__spreadArray([], prev, true), [value], false);
  }, [""]).join("");
};
var isNumber = function(input) {
  return RegExp(/\d/, "gi").test(input);
};
var padTrimValue = function(value, decimalSeparator, decimalScale) {
  if (decimalScale === void 0 || decimalSeparator === "" || decimalSeparator === void 0 || value === "" || value === void 0) {
    return value;
  }
  if (!value.match(/\d/g)) {
    return "";
  }
  var int = value.split(decimalSeparator)[0];
  if (decimalScale === 0) {
    return int;
  }
  var numberFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalScale,
    maximumFractionDigits: decimalScale
  });
  var stringValueWithoutSeparator = value.replace(decimalSeparator, ".");
  return numberFormatter.format(parseFloat(stringValueWithoutSeparator)).replace(/,/g, "");
};
var repositionCursor = function(_a) {
  var selectionStart = _a.selectionStart, value = _a.value, lastKeyStroke = _a.lastKeyStroke, stateValue = _a.stateValue, groupSeparator = _a.groupSeparator;
  var cursorPosition = selectionStart;
  var modifiedValue = value;
  if (stateValue && cursorPosition) {
    var splitValue = value.split("");
    if (lastKeyStroke === "Backspace" && stateValue[cursorPosition] === groupSeparator) {
      splitValue.splice(cursorPosition - 1, 1);
      cursorPosition -= 1;
    }
    if (lastKeyStroke === "Delete" && stateValue[cursorPosition] === groupSeparator) {
      splitValue.splice(cursorPosition, 1);
      cursorPosition += 1;
    }
    modifiedValue = splitValue.join("");
    return { modifiedValue, cursorPosition };
  }
  return { modifiedValue, cursorPosition: selectionStart };
};
var CurrencyInput$1 = forwardRef(function(_a, ref) {
  var _b = _a.allowDecimals, allowDecimals = _b === void 0 ? true : _b, _c = _a.allowNegativeValue, allowNegativeValue = _c === void 0 ? true : _c, id = _a.id, name = _a.name, className = _a.className, customInput = _a.customInput, decimalsLimit = _a.decimalsLimit, defaultValue = _a.defaultValue, _d = _a.disabled, disabled = _d === void 0 ? false : _d, userMaxLength = _a.maxLength, userValue = _a.value, onValueChange = _a.onValueChange, fixedDecimalLength = _a.fixedDecimalLength, _placeholder = _a.placeholder, decimalScale = _a.decimalScale, prefix = _a.prefix, suffix = _a.suffix, intlConfig = _a.intlConfig, step = _a.step, min = _a.min, max = _a.max, _e = _a.disableGroupSeparators, disableGroupSeparators = _e === void 0 ? false : _e, _f = _a.disableAbbreviations, disableAbbreviations = _f === void 0 ? false : _f, _decimalSeparator = _a.decimalSeparator, _groupSeparator = _a.groupSeparator, onChange = _a.onChange, onFocus = _a.onFocus, onBlur = _a.onBlur, onKeyDown = _a.onKeyDown, onKeyUp = _a.onKeyUp, transformRawValue = _a.transformRawValue, _g = _a.formatValueOnBlur, formatValueOnBlur = _g === void 0 ? true : _g, props = __rest(_a, ["allowDecimals", "allowNegativeValue", "id", "name", "className", "customInput", "decimalsLimit", "defaultValue", "disabled", "maxLength", "value", "onValueChange", "fixedDecimalLength", "placeholder", "decimalScale", "prefix", "suffix", "intlConfig", "step", "min", "max", "disableGroupSeparators", "disableAbbreviations", "decimalSeparator", "groupSeparator", "onChange", "onFocus", "onBlur", "onKeyDown", "onKeyUp", "transformRawValue", "formatValueOnBlur"]);
  if (_decimalSeparator && isNumber(_decimalSeparator)) {
    throw new Error("decimalSeparator cannot be a number");
  }
  if (_groupSeparator && isNumber(_groupSeparator)) {
    throw new Error("groupSeparator cannot be a number");
  }
  var localeConfig = useMemo(function() {
    return getLocaleConfig(intlConfig);
  }, [intlConfig]);
  var decimalSeparator = _decimalSeparator || localeConfig.decimalSeparator || "";
  var groupSeparator = _groupSeparator || localeConfig.groupSeparator || "";
  if (decimalSeparator && groupSeparator && decimalSeparator === groupSeparator && disableGroupSeparators === false) {
    throw new Error("decimalSeparator cannot be the same as groupSeparator");
  }
  var formatValueOptions = {
    decimalSeparator,
    groupSeparator,
    disableGroupSeparators,
    intlConfig,
    prefix: prefix || localeConfig.prefix,
    suffix
  };
  var cleanValueOptions = {
    decimalSeparator,
    groupSeparator,
    allowDecimals,
    decimalsLimit: decimalsLimit || fixedDecimalLength || 10,
    allowNegativeValue,
    disableAbbreviations,
    prefix: prefix || localeConfig.prefix,
    transformRawValue
  };
  var placeholder = _placeholder !== null && _placeholder !== void 0 ? _placeholder : formatValue$1(__assign(__assign({}, formatValueOptions), { decimalScale, value: "0" }));
  var _h = useState(function() {
    return defaultValue != null ? formatValue$1(__assign(__assign({}, formatValueOptions), { decimalScale, value: String(defaultValue) })) : userValue != null ? formatValue$1(__assign(__assign({}, formatValueOptions), { decimalScale, value: String(userValue) })) : "";
  }), stateValue = _h[0], setStateValue = _h[1];
  var _j = useState(false), dirty = _j[0], setDirty = _j[1];
  var _k = useState(0), cursor = _k[0], setCursor = _k[1];
  var _l = useState(0), changeCount = _l[0], setChangeCount = _l[1];
  var _m = useState(null), lastKeyStroke = _m[0], setLastKeyStroke = _m[1];
  var inputRef = useRef(null);
  useImperativeHandle(ref, function() {
    return inputRef.current;
  });
  var processChange = function(value, selectionStart) {
    setDirty(true);
    var _a2 = repositionCursor({
      selectionStart,
      value,
      lastKeyStroke,
      stateValue,
      groupSeparator
    }), modifiedValue = _a2.modifiedValue, cursorPosition = _a2.cursorPosition;
    var stringValue = cleanValue(__assign({ value: modifiedValue }, cleanValueOptions));
    if (userMaxLength && stringValue.replace(/-/g, "").length > userMaxLength) {
      return;
    }
    if (stringValue === "" || stringValue === "-" || stringValue === decimalSeparator) {
      onValueChange && onValueChange(void 0, name, { float: null, formatted: "", value: "" });
      setStateValue(stringValue);
      setCursor(1);
      return;
    }
    var stringValueWithoutSeparator = decimalSeparator ? stringValue.replace(decimalSeparator, ".") : stringValue;
    var numberValue = parseFloat(stringValueWithoutSeparator);
    var formattedValue = formatValue$1(__assign({ value: stringValue }, formatValueOptions));
    if (cursorPosition != null) {
      var newCursor = cursorPosition + (formattedValue.length - value.length);
      newCursor = newCursor <= 0 ? prefix ? prefix.length : 0 : newCursor;
      setCursor(newCursor);
      setChangeCount(changeCount + 1);
    }
    setStateValue(formattedValue);
    if (onValueChange) {
      var values = {
        float: numberValue,
        formatted: formattedValue,
        value: stringValue
      };
      onValueChange(stringValue, name, values);
    }
  };
  var handleOnChange = function(event) {
    var _a2 = event.target, value = _a2.value, selectionStart = _a2.selectionStart;
    processChange(value, selectionStart);
    onChange && onChange(event);
  };
  var handleOnFocus = function(event) {
    onFocus && onFocus(event);
    return stateValue ? stateValue.length : 0;
  };
  var handleOnBlur = function(event) {
    setDirty(false);
    var value = event.target.value;
    var valueOnly = cleanValue(__assign({ value }, cleanValueOptions));
    if (valueOnly === "-" || valueOnly === decimalSeparator || !valueOnly) {
      setStateValue("");
      onBlur && onBlur(event);
      return;
    }
    var fixedDecimals = fixedDecimalValue(valueOnly, decimalSeparator, fixedDecimalLength);
    var newValue = padTrimValue(fixedDecimals, decimalSeparator, decimalScale !== void 0 ? decimalScale : fixedDecimalLength);
    var numberValue = parseFloat(newValue);
    if (min) {
      var minNumber = parseFloat(min === null || min === void 0 ? void 0 : min.toString());
      if (numberValue < minNumber) {
        numberValue = minNumber;
      }
    }
    if (max) {
      var maxNumber = parseFloat(max === null || max === void 0 ? void 0 : max.toString());
      if (numberValue > maxNumber) {
        numberValue = maxNumber;
      }
    }
    var stringNumber = numberValue.toString();
    var formattedValue = formatValue$1(__assign(__assign({}, formatValueOptions), { value: stringNumber }));
    if (onValueChange && formatValueOnBlur) {
      onValueChange(stringNumber, name, {
        float: numberValue,
        formatted: formattedValue,
        value: stringNumber
      });
    }
    setStateValue(formattedValue);
    onBlur && onBlur(event);
  };
  var handleOnKeyDown = function(event) {
    var key = event.key;
    setLastKeyStroke(key);
    if (step && (key === "ArrowUp" || key === "ArrowDown")) {
      event.preventDefault();
      setCursor(stateValue.length);
      var stringValue = userValue != null ? String(userValue) : void 0;
      var stringValueWithoutSeparator = decimalSeparator && stringValue ? stringValue.replace(decimalSeparator, ".") : stringValue;
      var currentValue = parseFloat(stringValueWithoutSeparator != null ? stringValueWithoutSeparator : cleanValue(__assign({ value: stateValue }, cleanValueOptions))) || 0;
      var newValue = key === "ArrowUp" ? currentValue + step : currentValue - step;
      if (min !== void 0 && newValue < Number(min) || !allowNegativeValue && newValue < 0) {
        return;
      }
      if (max !== void 0 && newValue > Number(max)) {
        return;
      }
      var fixedLength = String(step).includes(".") ? Number(String(step).split(".")[1].length) : void 0;
      processChange(String(fixedLength ? newValue.toFixed(fixedLength) : newValue).replace(".", decimalSeparator));
    }
    onKeyDown && onKeyDown(event);
  };
  var handleOnKeyUp = function(event) {
    var key = event.key, selectionStart = event.currentTarget.selectionStart;
    if (key !== "ArrowUp" && key !== "ArrowDown" && stateValue !== "-") {
      var suffix_1 = getSuffix(stateValue, { groupSeparator, decimalSeparator });
      if (suffix_1 && selectionStart && selectionStart > stateValue.length - suffix_1.length) {
        if (inputRef.current) {
          var newCursor = stateValue.length - suffix_1.length;
          inputRef.current.setSelectionRange(newCursor, newCursor);
        }
      }
    }
    onKeyUp && onKeyUp(event);
  };
  useEffect(function() {
    if (userValue == null && defaultValue == null) {
      setStateValue("");
    }
  }, [defaultValue, userValue]);
  useEffect(function() {
    if (dirty && stateValue !== "-" && inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.setSelectionRange(cursor, cursor);
    }
  }, [stateValue, cursor, inputRef, dirty, changeCount]);
  var getRenderValue = function() {
    if (userValue != null && stateValue !== "-" && (!decimalSeparator || stateValue !== decimalSeparator)) {
      return formatValue$1(__assign(__assign({}, formatValueOptions), { decimalScale: dirty ? void 0 : decimalScale, value: String(userValue) }));
    }
    return stateValue;
  };
  var inputProps = __assign({ type: "text", inputMode: "decimal", id, name, className, onChange: handleOnChange, onBlur: handleOnBlur, onFocus: handleOnFocus, onKeyDown: handleOnKeyDown, onKeyUp: handleOnKeyUp, placeholder, disabled, value: getRenderValue(), ref: inputRef }, props);
  if (customInput) {
    var CustomInput = customInput;
    return React__default.createElement(CustomInput, __assign({}, inputProps));
  }
  return React__default.createElement("input", __assign({}, inputProps));
});
CurrencyInput$1.displayName = "CurrencyInput";
const CurrencyInput = forwardRef(function CurrencyInput2({
  className,
  value,
  onValueChange,
  currencyCode,
  decimalScale: _decimalScale,
  min,
  max,
  ...props
}, ref) {
  const { t, loading } = useLaravelReactI18n();
  const { default_currency_id } = usePage().props.preferences;
  const prevValueRef = useRef(value);
  const [data, setData] = useState({
    value: Number.isNaN(value) ? "" : (value == null ? void 0 : value.toString()) ?? "",
    values: { float: Number.isNaN(value) ? null : value }
  });
  const [intlConfig, decimalScale] = useMemo(() => {
    var _a;
    const config = {
      locale: loading ? void 0 : t("lang.locale"),
      currency: currencyCode == "default" ? default_currency_id : !currencyCode ? void 0 : currencyCode
    };
    try {
      const numberFormatter2 = config.locale ? new Intl.NumberFormat(config.locale, {
        ...config.currency && {
          currency: config.currency,
          style: "currency"
        }
      }) : new Intl.NumberFormat();
      return [
        config,
        ((_a = numberFormatter2.formatToParts(value).find((x) => x.type == "fraction")) == null ? void 0 : _a.value.length) ?? _decimalScale
      ];
    } catch {
      return [
        {
          locale: loading ? void 0 : t("lang.locale")
        },
        _decimalScale
      ];
    }
  }, [loading, currencyCode, _decimalScale]);
  const numberFormatter = useMemo(() => {
    const numberFormatter2 = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: _decimalScale || props.fixedDecimalLength || 0,
      maximumFractionDigits: _decimalScale || props.fixedDecimalLength || props.decimalsLimit || 10
    });
    return numberFormatter2;
  }, [props, _decimalScale]);
  useDidMountEffect(() => {
    if (prevValueRef.current == value) return;
    if (Number.isNaN(value)) {
      prevValueRef.current = value;
      setData({
        value: "",
        values: { float: null }
      });
    } else {
      if (max && value > max) {
        value = max;
      }
      if (min && value < min) {
        value = min;
      }
      prevValueRef.current = value;
      const valueFormatted = numberFormatter.format(value).replace(/,/g, "");
      setData({
        value: valueFormatted,
        values: { float: parseFloat(value) }
      });
    }
  }, [value]);
  return /* @__PURE__ */ jsx(
    CurrencyInput$1,
    {
      ref,
      intlConfig,
      value: (data == null ? void 0 : data.value) ?? "",
      onValueChange: (value2, name, values) => {
        var _a;
        setData({ value: value2, name, values });
        if (!onValueChange) return;
        const float = (_a = data == null ? void 0 : data.values) == null ? void 0 : _a.float;
        if (prevValueRef.current == float) return;
        prevValueRef.current = float;
        onValueChange(float);
      },
      onKeyDown: (e) => {
        if (e.key == "Enter" || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
          e.target.blur();
        }
      },
      decimalScale,
      decimalsLimit: 10,
      min,
      max,
      className: cn(
        "text-right focus:border-0! flex h-8 w-full rounded-md border border-input bg-muted px-3 py-2 text-base ring-offset-background  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      ),
      ...props
    }
  );
});
const formatValue = formatValue$1;
export {
  CurrencyInput as C,
  formatValue as f
};
