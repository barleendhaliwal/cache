import {MixinTarget} from '@loopback/core';
import {
  AnyObject,
  DefaultCrudRepository,
  Entity,
  Filter,
  FilterExcludingWhere,
  JugglerDataSource,
  Options
} from '@loopback/repository';
import {TextDecoder} from 'util';
import {CacheOptions} from '../types';

const decoder = new TextDecoder('utf-8');

export function CacheRespositoryMixin<
  M extends Entity,
  ID,
  Relations extends object,
  R extends MixinTarget<DefaultCrudRepository<M, ID, Relations>>,
>(baseClass: R, cacheOptions: CacheOptions) {
  class MixedRepository extends baseClass {
    cacheDataSource: JugglerDataSource;

    /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
    // @ts-ignore
    async findById(
      id: ID,
      filter?: FilterExcludingWhere<M>,
      options?: Options,
    ): Promise<M> {
      this.checkDataSource();
      const key = this.getKey(id, filter, options);
      const result = await this.searchInCache(key);
      let finalResult;
      if (result) {
        finalResult = result;
      } else {
        const dbEntry = await super.findById(id, filter, options);
        finalResult = dbEntry;
        this.saveInCache(key, dbEntry);
      }
      return finalResult as M;
    }

    /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
    // @ts-ignore
    async find(
      filter?: Filter<M> | undefined,
      options?: AnyObject | undefined,
    ): Promise<M[]> {
      this.checkDataSource();
      const key = this.getKey(undefined, filter, options);
      const result = await this.searchInCache(key);
      let finalResult;
      if (result) {
        finalResult = result;
      } else {
        const dbEntry = await super.find(filter, options);
        finalResult = dbEntry;
        this.saveInCache(key, dbEntry);
      }
      return finalResult as M[];
    }

    async searchInCache(key: string) {
      let result = undefined;
      if (this.cacheDataSource.connector?.execute) {
        try {
          const res = await this.executeRedisCommand('GET', [key]);
          if (res) {
            result = JSON.parse(decoder.decode(res as ArrayBuffer));
          }
        } catch (err) {
          throw new Error(`Unable to search in Cache : ${err}`);
        }
        return result;
      }
    }

    saveInCache(key: string, value: AnyObject) {
      if (this.cacheDataSource.connector?.execute) {
        try {
          this.executeRedisCommand('SET', [
            key,
            JSON.stringify(value),
            `PX`,
            cacheOptions.ttl ?? 60000,
          ]);
        } catch (err) {
          throw new Error(`Unable to save in Cache : ${err}`);
        }
      }
    }

    getKey(id?: ID, filter?: FilterExcludingWhere<M>, options?: Options) {
      let key = cacheOptions.prefix;
      if (id) {
        key += `_${id}`;
      }
      if (filter) {
        key += `_${JSON.stringify(filter)}`;
      }
      if (options) {
        key += `_${JSON.stringify(options)}`;
      }
      return key;
    }

    //returns number of keys deleted
    async clearCache() {
      this.checkDataSource();
      const result = await this.getMatchingKeys() as string[];
      if (this.cacheDataSource.connector?.execute && result.length) {
        const count = await this.executeRedisCommand('DEL', result);
        return count;
      } else {
        return 0;
      }
    }

    // returns all keys that match with prefix using SCAN command.
    // need to write it like this because cursor is updated asynchronously. reference: https://stackoverflow.com/questions/43064719/javascript-asynchronous-method-in-while-loop
    getMatchingKeys() {
      return new Promise((resolve, reject) => {
        this.scanAllKeys(resolve, reject);
      });
    }

    //scans and returns all keys till cursor becomes zero
    async scanAllKeys(
      resolve: any,
      reject: any,
      cursor: number = 0,
      keys: string[] = [],
    ) {
      const res: {cursor: number; keys: string[]} = await this.scanKeys(cursor);
      cursor = res.cursor;
      keys.push(...res.keys);
      if (cursor === 0) {
        resolve(keys);
      } else {
        await this.scanAllKeys(resolve, reject, cursor, keys);
      }
    }

    async scanKeys(cursor: number): Promise<{cursor: number; keys: string[]}> {
      try {
        const res: any = await this.executeRedisCommand('SCAN', [
          cursor,
          'MATCH',
          `${cacheOptions.prefix}*`,
          'COUNT',
          cacheOptions.scanCount ?? 100,
        ]);
        const keys: string[] = [];
        res[1].forEach((key: Buffer) => {
          keys.push(decoder.decode(key));
        });
        const result = {
          cursor: parseInt(decoder.decode(res[0])),
          keys,
        };
        return result;
      } catch (err) {
        throw new Error(
          `Unable to get matching keys for clearing cache ${err}`,
        );
      }
    }

    checkDataSource() {
      if (!this.cacheDataSource) {
        throw new Error(`Please provide value for cacheDataSource`);
      }
    }

    // returns promisified execute function
    executeRedisCommand(command: string, args: (string | number)[]) {
      return new Promise((resolve, reject) => {
        if (this.cacheDataSource.connector?.execute) {
          this.cacheDataSource.connector.execute(
            command,
            args,
            (err: Error, res: Buffer) => {
              if (err) {
                reject(err);
              }
              if (res) {
                resolve(res);
              } else {
                return resolve(undefined);
              }
            },
          );
        }
      });
    }
  }
  return MixedRepository;
}
