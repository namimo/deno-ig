export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export interface ICallSendApiOptions {
  recipient: { id: string };
  message: { text: string };
}

interface IIgConversationMessageData {
  id: string;
  from: {
    id: string;
    username: string;
  };
  to: {
    data: {
      id: string;
      username: string;
    }[];
  };
  message: string;
}

export interface IIgConversation {
  data: {
    id: string;
    messages: {
      data: IIgConversationMessageData[];
      paging: {
        cursors: { after: string };
        next: string;
      };
    };
  }[];
}

export interface IIgPost {
  id: string;
  caption: string;
}
