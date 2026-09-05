import { NotFoundException } from '@nestjs/common';
import {
  DeepPartial,
  FindOptionsRelations,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import {
  findAllByPage,
  findOne as skFindOne,
  IPage,
  IPageSearch,
  Page,
} from '@sksharma72000/nestjs-search-page';
import { PageDto } from '../dto/page.dto';

/**
 * Thin generic wrapper around `@sksharma72000/nestjs-search-page`.  One instance
 * per aggregate repository — see NEST_SEARCH.MD, the "four-file pattern".
 */
export class CommonService<T extends ObjectLiteral> {
  constructor(protected readonly repo: Repository<T>) {}

  private toIPage(page: PageDto): IPage {
    return {
      _start: Number(page._start) || 0,
      _end: Number(page._end) || 25,
      _sort: page._sort || 'id',
      _order: (String(page._order || 'DESC').toUpperCase() === 'ASC'
        ? 'ASC'
        : 'DESC') as IPage['_order'],
    };
  }

  /** List + filter + paginate. `customQuery` carries tenancy/visibility rules. */
  list(
    page: PageDto,
    queryDto: object,
    customQuery: IPageSearch[] = [],
  ): Promise<Page<T>> {
    return findAllByPage<T>({
      repo: this.repo,
      page: this.toIPage(page),
      queryDto,
      // findOne/findAllByPage push into the array they are handed — always a fresh literal.
      customQuery: [...customQuery],
    });
  }

  async getOne(
    id: string,
    relations?: FindOptionsRelations<T>,
    customQuery: IPageSearch[] = [],
  ): Promise<T> {
    const row = customQuery.length
      ? await skFindOne<T>({ id, repo: this.repo, customQuery: [...customQuery] })
      : await this.repo.findOne({
          where: { id } as any,
          relations,
        });
    if (!row) throw new NotFoundException(`${this.repo.metadata.name} ${id} not found`);
    return row;
  }

  async create(data: DeepPartial<T>): Promise<T> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: DeepPartial<T>): Promise<T> {
    const row = await this.getOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<T> {
    const row = await this.getOne(id);
    return this.repo.remove({ ...row } as T);
  }
}
