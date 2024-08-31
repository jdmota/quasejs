export type FromParent =
  | {
      type: "hello";
    }
  | {
      type: "echo";
      value: number;
    }
  | {
      type: "terminate";
    }
  | {
      type: "crash";
    };

export type FromChild =
  | {
      type: "hello-response";
    }
  | {
      type: "echo-response";
      value: number;
    }
  | {
      type: "bye";
    };
