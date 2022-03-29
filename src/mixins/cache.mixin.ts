import {MixinTarget} from '@loopback/core';
import {
  AnyObject,
  DefaultCrudRepository,
  Entity,
  Filter,
  FilterExcludingWhere,
  JugglerDataSource,
  Options,
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

      return this.searchInCache(key).then(async result => {
        let finalResult;
        if (result) {
          finalResult = result;
        } else {
          const dbEntry = await super.findById(id, filter, options);
          finalResult = dbEntry;
          this.saveInCache(key, dbEntry);
        }
        return finalResult as M;
      });
    }

    /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
    // @ts-ignore
    async find(
      filter?: Filter<M> | undefined,
      options?: AnyObject | undefined,
    ): Promise<M[]> {
      this.checkDataSource();
      const key = this.getKey(undefined, filter, options);

      return this.searchInCache(key).then(async result => {
        let finalResult;
        if (result) {
          finalResult = result;
        } else {
          const dbEntry = await super.find(filter, options);
          finalResult = dbEntry;
          this.saveInCache(key, dbEntry);
        }
        return finalResult as M[];
      });
    }

    searchInCache(key: string): Promise<M | M[] | undefined> {
      return new Promise((resolve, reject) => {
        if (this.cacheDataSource.connector?.execute) {
          this.cacheDataSource.connector.execute(
            'GET',
            [key],
            (err: Error, res: Buffer) => {
              if (err) {
                reject(err);
              }
              if (res) {
                const result = JSON.parse(decoder.decode(res));
                resolve(result);
              } else {
                return resolve(undefined);
              }
            },
          );
        }
      });
    }

    saveInCache(key: string, value: AnyObject) {
      if (this.cacheDataSource.connector?.execute) {
        this.cacheDataSource.connector?.execute(
          'SET',
          [key, JSON.stringify(value), `PX`, cacheOptions.ttl ?? 60000],
          (err: Error) => {
            if (err) {
              throw new Error(`Unable to save in Cache ${err}`);
            }
          },
        );
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
    clearCache() {
      this.checkDataSource();
      return new Promise((resolve, reject) => {
        this.getMatchingKeys().then(result => {
          const keys = result as Buffer[];
          const keysToDelete: string[] = [];
          keys.forEach((key, i) => {
            keysToDelete.push(decoder.decode(key));
          });
          if (this.cacheDataSource.connector?.execute && keysToDelete.length) {
            this.cacheDataSource.connector?.execute(
              'DEL',
              [keysToDelete],
              (err: Error, result: number) => {
                if (err) {
                  reject(err);
                }
                resolve(result);
              },
            );
          } else {
            resolve(0);
          }
        });
      });
    }

    getMatchingKeys() {
      return new Promise((resolve, reject) => {
        if (this.cacheDataSource.connector?.execute) {
          this.cacheDataSource.connector?.execute(
            'KEYS',
            [`${cacheOptions.prefix}*`],
            (err: Error, res: any) => {
              if (err) {
                reject(err);
              } else {
                resolve(res);
              }
            },
          );
        }
      });
    }

    checkDataSource() {
      if (!this.cacheDataSource) {
        throw new Error(`Please provide value for cacheDataSource`);
      }
    }
  }
  return MixedRepository;
}