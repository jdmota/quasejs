export default (obj: unknown): obj is PromiseLike<unknown> => {
  return (
    typeof obj === "object" &&
    obj != null &&
    // @ts-ignore
    typeof obj.then === "function"
  );
};
