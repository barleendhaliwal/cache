import {inject} from '@loopback/core';
import {DefaultKeyValueRepository} from '@loopback/repository';
import {RedisDataSource} from '../datasources';
import {Product} from '../models';

export class ProductRedisRepository extends DefaultKeyValueRepository<Product> {
  constructor(
    @inject(`datasources.CacheDB`) dataSource: RedisDataSource,
  ) {
    super(Product, dataSource);
  }
}
