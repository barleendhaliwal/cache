export interface CacheOptions {
  prefix: string;
  ttl?: number;
}
export const CacheDbSourceName = 'CacheDB';

// // export declare type CustomConstructor<T> = new (
// //   dataSource: DataSource,
// //   ...args: any[]
// // ) => T;
// // export declare type CustomMixinTarget<T extends object> = CustomConstructor<{
// //   [P in keyof T]: T[P];
// // }>;

// type GetProps<TBase> = TBase extends new (props: infer P) => any ? P : never;
// type GetInstance<TBase> = TBase extends new (...args: any[]) => infer I
//   ? I
//   : never;
// export type MergeCtor<A, B> = new (
//   props: GetProps<A> & GetProps<B>,
//   ...args: any[]
// ) => GetInstance<A> & GetInstance<B>;
