import { useState } from "react";
import { router } from "@inertiajs/react";

export default function useCart(initialCourses = [], initialCart = []) {
  const [courses, setCourses] = useState(initialCourses);
  const [cart, setCart] = useState(initialCart);

  const addToCart = (course) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === course.id ? { ...c, inCart: true } : c)),
    );

    setCart((prev) => [
      ...prev,
      { ...course, price: Number(course.price || 0) },
    ]);

    router.post(
      route("student.cart.store"),
      { course_id: course.id },
      {
        preserveScroll: true,
        onError: () => {
          setCourses((prev) =>
            prev.map((c) => (c.id === course.id ? { ...c, inCart: false } : c)),
          );
          setCart((prev) => prev.filter((c) => c.id !== course.id));
        },
      },
    );
  };

  const removeFromCart = (courseId) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, inCart: false } : c)),
    );

    setCart((prev) => prev.filter((c) => c.id !== courseId));

    router.delete(route("student.cart.destroy", courseId), {
      preserveScroll: true,
      onError: () => router.reload(),
    });
  };
  const resetCart = () => {
    setCart([]);
  };

  return {
    courses,
    cart,
    addToCart,
    removeFromCart,
    setCourses,
    setCart,
    resetCart,
  };
}
