import * as React from "react";
import { Clock } from "lucide-react";

import { TimePickerInput } from "../custom/time-picker/time-picker-input";
import { Calendar } from "./ui/calendar";

function DatetimePicker({ className, setDate: setGlobalDate, ...props }) {
  const minuteRef = React.useRef < HTMLInputElement > null;
  const hourRef = React.useRef < HTMLInputElement > null;
  const { selected: selectedDate } = props;
  const setDate = (dateInput) => {
    const date = new Date(selectedDate);
    date.setDate(dateInput.getDate());
    date.setMonth(dateInput.getMonth());
    date.setFullYear(dateInput.getFullYear());
    setGlobalDate(date);
  };
  const setTime = (dateInput) => {
    if (!dateInput) return;
    const time = new Date(selectedDate);
    time.setHours(dateInput.getHours());
    time.setMinutes(dateInput.getMinutes());
    setGlobalDate(time);
  };
  return (
    <>
      <Calendar
        mode="single"
        defaultMonth={Date.now()}
        selected={selectedDate}
        onSelect={setDate}
        numberOfMonths={1}
        className={className}
      />
      <hr className="my-0" />
      <div className="flex justify-between px-2 mt-4">
        <div className="flex items-center gap-2 text-gray-700">
          <Clock className="w-5 h-5" />
          <p className="text-sm font-medium">Time</p>
        </div>
        <div className="font-medium">
          <div className="flex items-center gap-2">
            <TimePickerInput
              picker="hours"
              date={selectedDate}
              setDate={setTime}
              ref={hourRef}
              onRightFocus={() => minuteRef.current?.focus()}
            />
            <span>:</span>
            <TimePickerInput
              picker="minutes"
              date={selectedDate}
              setDate={setTime}
              ref={minuteRef}
              onLeftFocus={() => hourRef.current?.focus()}
            />
          </div>
        </div>
      </div>
    </>
  );
}

DatetimePicker.displayName = "DatetimePicker";

export { DatetimePicker as DatetimePicker };
