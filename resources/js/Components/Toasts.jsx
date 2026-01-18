import { useEffect, useState } from "react";

import React from "react";
import { Transition } from "@headlessui/react";
import { usePage } from "@inertiajs/react";
import useToasts from "../Hooks/useToasts";

export default function Toasts() {
  const { toasts, addToast } = useToasts();
  const alerts = usePage().props.alerts;

  useEffect(() => {
    alerts?.forEach((alert) => {
      addToast({
        id: alert.id,
        title: alert.title,
        message: alert.message,
        type: alert.type,
        timeout: alert.timeout,
      });
    });
  }, [alerts]);

  return (
    <div className="flex flex-col-reverse fixed right-0  bottom-0 z-999 w-full max-w-[352px] overflow-x-hidden bg-transparent">
      {toasts.map((toast) => {
        return (
          <Toast
            key={toast.id}
            id={toast.id}
            title={toast.title}
            message={toast.message}
            type={toast.type}
            timeout={toast.timeout}
          />
        );
      })}
    </div>
  );
}

const Toast = React.memo(({ id, type, title, message, timeout }) => {
  const { removeToast, toasts } = useToasts();
  const [visible, setVisible] = useState(false);
  const [progressBar, setProgressBar] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    if (toasts.length > 3) {
      if (id === toasts[toasts.length - 1].id) {
        setVisible(false);
      }
    }
  }, [toasts]);

  return (
    <>
      <Transition
        show={visible}
        enter="transition ease-out duration-300 "
        enterFrom="opacity-0 translate-x-8"
        enterTo="opacity-100 translate-x-0"
        leave="transition ease-in duration-200 "
        leaveFrom="opacity-100 translate-x-0"
        leaveTo="opacity-0 translate-x-8"
        afterEnter={() => {
          setProgressBar(true);
        }}
        afterLeave={() => {
          removeToast(id);
        }}
      >
        <div className={`toast ${type}`}>
          <div className="h-0.5 w-full bg-inherit">
            <div
              className={`progress h-0.5 transition-all ease-linear rounded-full ${progressBar ? "w-[0%]" : "w-full"}`}
              style={{ transitionDuration: `${timeout}ms` }}
              onTransitionEnd={() => {
                setVisible(false);
              }}
            ></div>
          </div>
          <div className="flex items-start p-4">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m0-4h.01M12 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <div className="flex-1 ml-2">
              <h3 className="text-base font-medium title">{title}</h3>
              <div className="mt-1 text-sm message">{message}</div>
            </div>
            <button
              className="button ml-2 p-1! text-gray-700 dark:text-gray-500"
              type="button"
              onClick={() => {
                setVisible(false);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-4"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"
                />
              </svg>
            </button>
          </div>
        </div>
      </Transition>
    </>
  );
});

Toast.displayName = "Toast";
