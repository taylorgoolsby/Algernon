import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import Text from './Text';
import { query } from '../schema/database';
import sqltag, {raw} from '@taylorgoolsby/sql-template-tag';
import MessageInterface from '../schema/Message/MessageInterface';
import type { MessageSQL } from '../schema/Message/MessageSchema';
import AnnotationInterface from '../schema/Annotation/AnnotationInterface';

type TableData = {
  name: string;
  values: Array<Record<string, any>>;
};

async function getTables() {
  const sql = sqltag`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name ASC;
  `;

  return query(sql);
}

async function getTableValues(name: string): Promise<Array<Record<string, any>>> {
  switch (name) {
    case 'Message':
      return MessageInterface.getAllExplorer();
    case 'Annotation':
      return AnnotationInterface.getAllExplorer();
    default:
      // No explorer interface for this table (yet)
      return [];
  }
}

export default function DatabaseExplorer() {
  const [tables, setTables] = useState<TableData[]>([]);

  useEffect(() => {
    // getTables().then(setTables).catch(console.error);
    (async () => {
      const tablesResult = await getTables();
      /* tablesResult: 
      [ { name: 'Annotation' },
      { name: 'Completion' },
      { name: 'Message' },
      { name: 'ShortTermMemory' },
      { name: 'sqlite_sequence' },
      insertId: undefined ]
      */

      const tableNames = tablesResult
        .map((table: any) => table.name);
      /* tableNames:
      [ 'Annotation', 'Completion', 'Message', 'ShortTermMemory' ]
      */

      const loaded: TableData[] = await Promise.all(
        tableNames.map(async (name: string) => ({
          name,
          values: await getTableValues(name),
        })),
      );

      setTables(loaded);
    })();
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: 'white' }}
      contentContainerStyle={{ padding: 25, gap: 12 }}
    >
      <Text style={{ color: 'black', fontWeight: 'bold' }}>
        Database Explorer
      </Text>
      {tables.map((table) => (
        <DBTable key={table.name} name={table.name} values={table.values} />
      ))}
    </ScrollView>
  );
}

const INDENT = 8;
const COL_WIDTH = 120;

function formatCell(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function Cell(props: { text: string; bold?: boolean }) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled // lets the inner scroll work inside the outer horizontal ScrollView on Android
      showsHorizontalScrollIndicator={false}
      style={{ width: COL_WIDTH, flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ alignItems: 'center', paddingRight: 8 }}
    >
      <Text
        style={{ color: 'black', fontWeight: props.bold ? 'bold' : 'normal' }}
        numberOfLines={1}
      >
        {props.text}
      </Text>
    </ScrollView>
  );
}

function DBTable(props: { name: string; values: Array<Record<string, any>> }) {
  const { name, values } = props;
  const [expanded, setExpanded] = useState(false);

  const columns = values.length > 0 ? Object.keys(values[0]) : [];

  return (
    <View
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.025)',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.25)',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 6,
          paddingLeft: INDENT,
          paddingRight: 8,
          borderBottomWidth: expanded ? 1 : 0,
          borderColor: 'rgba(0, 0, 0, 0.25)',
        }}
      >
        <Text
          style={{ color: 'black', fontWeight: '600' }}
          onPress={() => setExpanded((e) => !e)}
        >
          {expanded ? '▾' : '▸'} {name}
        </Text>
        <Text style={{ color: 'gray' }}>{values.length} rows</Text>
      </View>

      {expanded && (
        <>
          {columns.length === 0 ? (
            <View style={{ paddingLeft: INDENT * 2, paddingVertical: 6 }}>
              <Text style={{ color: 'gray' }}>No data</Text>
            </View>
          ) : (
            <ScrollView horizontal nestedScrollEnabled>
              <View>
                {/* Header row */}
                <View
                  style={{
                    flexDirection: 'row',
                    paddingLeft: INDENT * 2,
                    paddingRight: 8,
                    paddingVertical: 4,
                    borderBottomWidth: 1,
                    borderColor: 'rgba(0, 0, 0, 0.15)',
                  }}
                >
                  {columns.map((col) => (
                    <Cell key={col} text={col} bold />
                  ))}
                </View>

                {/* Data rows */}
                {values.map((row, i) => (
                  <View
                    key={row.id ?? i}
                    style={{
                      flexDirection: 'row',
                      paddingLeft: INDENT * 2,
                      paddingRight: 8,
                      paddingVertical: 4,
                      backgroundColor:
                        i % 2 === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    {columns.map((col) => (
                      <Cell key={col} text={formatCell(row[col])} />
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}