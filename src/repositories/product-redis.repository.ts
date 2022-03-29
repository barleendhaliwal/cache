import {inject} from '@loopback/core';
import {DefaultKeyValueRepository} from '@loopback/repository';
import {RedisDataSource} from '../datasources';
import {Product} from '../models';
import {CacheDbSourceName} from '../types';

export class ProductRedisRepository extends DefaultKeyValueRepository<Product> {
  constructor(
    @inject(`datasources.${CacheDbSourceName}`) dataSource: RedisDataSource,
  ) {
    super(Product, dataSource);
  }
}
