import SYMBOL_OBSERVABLE from "./observable-symbol";

export default <T>(value: any): Promise<T> => {
  return new Promise((resolve, reject) => {
    value[SYMBOL_OBSERVABLE()]().subscribe({
      complete: resolve,
      error: reject,
    });
  });
};
