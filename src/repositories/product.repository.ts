import {Constructor, inject} from '@loopback/core';
import {
  Count,
  DefaultCrudRepository,
  Options,
  Where,
} from '@loopback/repository';
import {ExptDataSource, RedisDataSource} from '../datasources';
import {CacheRespositoryMixin} from '../mixins/cache.mixin';
import {Product, ProductRelations} from '../models';
import {CacheDbSourceName} from '../types';

export class ProductRepository extends CacheRespositoryMixin<
  Product,
  typeof Product.prototype.id,
  ProductRelations,
  Constructor<
    DefaultCrudRepository<
      Product,
      typeof Product.prototype.id,
      ProductRelations
    >
  >
>(DefaultCrudRepository, {prefix: 'product', ttl: 50000}) {
  redisDataSource: RedisDataSource;
  constructor(
    @inject('datasources.expt') dataSource: ExptDataSource,
    @inject(`datasources.${CacheDbSourceName}`)
    public cacheDataSource: RedisDataSource,
  ) {
    super(Product, dataSource);
    // console.log(cacheDataSource);
  }

  // @ts-ignore
  count(where?: Where<Product>, options?: Options): Promise<Count> {
    super.clearCache().then(res => {
      console.log(res);
    });
    return super.count(where, options);
  }
}
