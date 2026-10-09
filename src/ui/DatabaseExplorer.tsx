import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  NativeModules,
  Alert,
  Pressable,
} from 'react-native';
import Text from './Text';
import { query } from '../schema/database';
import sqltag from '@taylorgoolsby/sql-template-tag';
import MessageInterface from '../schema/Message/MessageInterface';
import AnnotationInterface from '../schema/Annotation/AnnotationInterface';

const { FaissBridge } = NativeModules;

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
  const [faissCount, setFaissCount] = useState<number | null>(null);
  const [faissError, setFaissError] = useState<string | null>(null);
  const [faissBusy, setFaissBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const tablesResult = await getTables();

      const tableNames = tablesResult.map((table: any) => table.name);

      const loaded: TableData[] = await Promise.all(
        tableNames.map(async (name: string) => ({
          name,
          values: await getTableValues(name),
        })),
      );

      setTables(loaded);
    })().catch(console.error);
  }, []);

  const refreshFaiss = useCallback(async () => {
    try {
      const count: number = await FaissBridge.ntotal();
      setFaissCount(count);
      setFaissError(null);
    } catch (e: any) {
      console.error(e);
      setFaissError(String(e?.message ?? e));
    }
  }, []);

  useEffect(() => {
    refreshFaiss();
  }, [refreshFaiss]);

  const deleteFaiss = useCallback(async () => {
    setFaissBusy(true);
    try {
      await FaissBridge.deleteAndReinitialize();
    } catch (e: any) {
      console.error(e);
      setFaissError(String(e?.message ?? e));
      setFaissBusy(false);
      return;
    }
    await refreshFaiss();
    setFaissBusy(false);
  }, [refreshFaiss]);

  const confirmDeleteFaiss = useCallback(() => {
    Alert.alert(
      'Delete FAISS index?',
      'This permanently removes all vectors and recreates an empty index. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteFaiss },
      ],
    );
  }, [deleteFaiss]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: 'white' }}
      contentContainerStyle={{ padding: 25, gap: 12 }}
    >
      <Text style={{ color: 'black', fontWeight: 'bold' }}>
        Database Explorer
      </Text>

      <FaissSummary
        count={faissCount}
        error={faissError}
        busy={faissBusy}
        onRefresh={refreshFaiss}
        onDelete={confirmDeleteFaiss}
      />

      {tables.map((table) => (
        <DBTable key={table.name} name={table.name} values={table.values} />
      ))}
    </ScrollView>
  );
}

const INDENT = 8;
const COL_WIDTH = 120;

function SmallButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const color = props.destructive ? '#c62828' : '#1565c0';
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: color,
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 10,
        opacity: props.disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color }}>{props.label}</Text>
    </Pressable>
  );
}

function FaissSummary(props: {
  count: number | null;
  error: string | null;
  busy: boolean;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const { count, error, busy, onRefresh, onDelete } = props;

  let right: string;
  if (busy) right = 'working…';
  else if (error) right = 'error';
  else if (count === null) right = 'loading…';
  else right = `${count} vectors`;

  return (
    <View
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.025)',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.25)',
        paddingVertical: 6,
        paddingLeft: INDENT,
        paddingRight: 8,
        gap: 8,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: 'black', fontWeight: '600' }}>FAISS Index</Text>
        <Text style={{ color: error ? 'red' : 'gray' }}>{right}</Text>
      </View>

      {error && <Text style={{ color: 'red' }}>{error}</Text>}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SmallButton label="Refresh" onPress={onRefresh} disabled={busy} />
        <SmallButton
          label="Delete & reinitialize"
          onPress={onDelete}
          disabled={busy}
          destructive
        />
      </View>
    </View>
  );
}

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