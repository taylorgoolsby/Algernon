// @flow

import { NativeModules } from 'react-native';
import { format } from "../utils/SqlString.js";
import type { Sql } from '@taylorgoolsby/sql-template-tag';

const { DatabaseModule } = NativeModules;

// function flattenSql(queryObject: {
//   sql: Array<string>,
//   values: Array<string>,
// }) {
function flattenSql(queryObject: Sql) {
  // The values of queryObject.sql and queryObject.values are arrays that you would be received by a template tag function.
  // This function flattens them into a single string.

  // console.log("queryObject.sql", queryObject.sql);
  // console.log("queryObject.values", queryObject.values);

  return format(queryObject.sql, queryObject.values).trim()
}

// export async function query(queryObject: {
//   sql: string,
//   values: Array<unknown>,
// }): Promise<any> {
export async function query(queryObject: Sql): Promise<any> {
  try {
    const queryString = flattenSql(queryObject);
    // const queryString = await DatabaseModule.format(queryObject.sql, queryObject.values);
    console.log("queryString", queryString);

    const res = await DatabaseModule.executeQuery(queryString);

    const results = res.results
    results['insertId'] = res.insertId

    console.log("results", results);

    if (queryString.toLowerCase().includes('select')) {
      return results;
    } else {
      return results;
    }
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

const database = {
  query
}

export default database
