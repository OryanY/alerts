// utils/QueryBuilder.js - SQL Query Builder for dynamic query construction
class QueryBuilder {
  constructor(tableName = 'dbo.historicalAlerts') {
    this.tableName = tableName;
    this.selectFields = [];
    this.whereConditions = [];
    this.orderByFields = [];
    this.limitValue = null;
    this.offsetValue = null;
    this.offsetLimit = null;
    this.parameters = [];
  }

  select(fields) {
    if (typeof fields === 'string') {
      this.selectFields = [fields];
    } else if (Array.isArray(fields)) {
      this.selectFields = fields;
    }
    return this;
  }

  from(tableName) {
    this.tableName = tableName;
    return this;
  }

  addWhere(condition) {
    if (condition && typeof condition === 'string') {
      this.whereConditions.push(condition);
    }
    return this;
  }

  where(condition) {
    this.whereConditions = [condition];
    return this;
  }

  orderBy(field, direction = 'ASC') {
    if (field) {
      const dir = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      this.orderByFields = [`${field} ${dir}`];
    }
    return this;
  }

  addOrderBy(field, direction = 'ASC') {
    if (field) {
      const dir = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      this.orderByFields.push(`${field} ${dir}`);
    }
    return this;
  }

  top(limit) {
    if (limit && typeof limit === 'number' && limit > 0) {
      this.limitValue = limit;
    }
    return this;
  }

  offset(offset, limit) {
    if (typeof offset === 'number' && offset >= 0) {
      this.offsetValue = offset;
      if (typeof limit === 'number' && limit > 0) {
        this.offsetLimit = limit;
      }
    }
    return this;
  }

  addParameter(name, type, value) {
    this.parameters.push({ name, type, value });
    return this;
  }

  build() {
    let sql = 'SELECT ';

    // Handle TOP clause for SQL Server
    if (this.limitValue && !this.offsetValue) {
      sql += `TOP (${this.limitValue}) `;
    }

    // SELECT fields
    if (this.selectFields.length > 0) {
      sql += this.selectFields.join(', ');
    } else {
      sql += '*';
    }

    // FROM clause
    sql += ` FROM ${this.tableName}`;

    // WHERE clause
    if (this.whereConditions.length > 0) {
      sql += ' WHERE ' + this.whereConditions.join(' AND ');
    }

    // ORDER BY clause
    if (this.orderByFields.length > 0) {
      sql += ' ORDER BY ' + this.orderByFields.join(', ');
    }

    // OFFSET/FETCH for pagination (SQL Server 2012+)
    if (this.offsetValue !== null) {
      if (this.orderByFields.length === 0) {
        // ORDER BY is required for OFFSET/FETCH
        sql += ' ORDER BY (SELECT NULL)';
      }
      sql += ` OFFSET ${this.offsetValue} ROWS`;
      if (this.offsetLimit) {
        sql += ` FETCH NEXT ${this.offsetLimit} ROWS ONLY`;
      }
    }

    return [sql, this.parameters];
  }

  // Helper method to build simple SELECT queries
  static simpleSelect(fields, tableName, conditions = []) {
    const qb = new QueryBuilder(tableName);
    qb.select(fields);
    
    conditions.forEach(condition => {
      qb.addWhere(condition);
    });

    return qb.build();
  }

  // Helper method to build paginated queries
  static paginatedSelect(fields, tableName, page, limit, orderBy = null, conditions = []) {
    const qb = new QueryBuilder(tableName);
    qb.select(fields);
    
    conditions.forEach(condition => {
      qb.addWhere(condition);
    });

    if (orderBy) {
      qb.orderBy(orderBy.field, orderBy.direction);
    }

    if (page && limit) {
      const offset = (page - 1) * limit;
      qb.offset(offset, limit + 1); // +1 to check for next page
    } else if (limit) {
      qb.top(limit);
    }

    return qb.build();
  }

  // Reset the builder for reuse
  reset() {
    this.selectFields = [];
    this.whereConditions = [];
    this.orderByFields = [];
    this.limitValue = null;
    this.offsetValue = null;
    this.offsetLimit = null;
    this.parameters = [];
    return this;
  }

  // Clone the current builder state
  clone() {
    const newBuilder = new QueryBuilder(this.tableName);
    newBuilder.selectFields = [...this.selectFields];
    newBuilder.whereConditions = [...this.whereConditions];
    newBuilder.orderByFields = [...this.orderByFields];
    newBuilder.limitValue = this.limitValue;
    newBuilder.offsetValue = this.offsetValue;
    newBuilder.offsetLimit = this.offsetLimit;
    newBuilder.parameters = [...this.parameters];
    return newBuilder;
  }
}

module.exports = { QueryBuilder };