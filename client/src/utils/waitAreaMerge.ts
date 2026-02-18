import type { StateItem, TableItem, TableField, StateEnumValue } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface ExtractedState {
  stateName: string;
  stateValues: string[];
  enumValues?: StateEnumValue[];
  description: string;
}

export interface ExtractedTable {
  tableName: string;
  description: string;
  fields: Array<{
    fieldName: string;
    fieldType: string;
    description: string;
    isRequired: boolean;
  }>;
}

export interface MergeAction {
  type: 'ADD_STATE' | 'UPDATE_STATE' | 'ADD_TABLE' | 'UPDATE_TABLE';
  payload: StateItem | TableItem;
}

export interface MergeResult {
  actions: MergeAction[];
  added: { states: number; tables: number };
  updated: { states: number; tables: number };
}

// ===== Comparison helpers =====

function normalizeType(t: string): string {
  return t.toUpperCase().replace(/[()（）\d,\s]/g, '').trim();
}

function stateValuesChanged(existing: StateItem, extracted: ExtractedState): boolean {
  const existingVals = new Set(existing.stateValues);
  const extractedVals = new Set(extracted.stateValues);
  if (existingVals.size !== extractedVals.size) return true;
  for (const v of extractedVals) {
    if (!existingVals.has(v)) return true;
  }
  if (extracted.enumValues?.length) {
    const existingEnums = existing.enumValues || [];
    if (existingEnums.length !== extracted.enumValues.length) return true;
    const existingKeyMap = new Map(existingEnums.map(e => [e.key, e.value]));
    for (const ev of extracted.enumValues) {
      const existingVal = existingKeyMap.get(ev.key);
      if (existingVal === undefined) return true;
      if (ev.value && existingVal !== ev.value) return true;
    }
  }
  return false;
}

function tableFieldsChanged(existing: TableItem, extracted: ExtractedTable): boolean {
  if (existing.fields.length !== extracted.fields.length) return true;

  const existingFieldNames = new Set(existing.fields.map(f => f.fieldName));
  const extractedFieldNames = new Set(extracted.fields.map(f => f.fieldName));

  for (const name of extractedFieldNames) {
    if (!existingFieldNames.has(name)) return true;
  }
  for (const name of existingFieldNames) {
    if (!extractedFieldNames.has(name)) return true;
  }

  if (extracted.description && existing.description && extracted.description !== existing.description) return true;

  const existingFieldMap = new Map(existing.fields.map(f => [f.fieldName, f]));
  for (const ef of extracted.fields) {
    const existingField = existingFieldMap.get(ef.fieldName);
    if (!existingField) return true;
    if (normalizeType(existingField.fieldType) !== normalizeType(ef.fieldType)) return true;
    if (ef.description && existingField.description !== ef.description) return true;
    if (ef.isRequired !== existingField.isRequired) return true;
  }

  return false;
}

// ===== Structural matching =====

const STRUCT_MATCH_THRESHOLD = 0.3;

function findStructuralTableMatch(
  extracted: ExtractedTable,
  candidates: TableItem[],
): TableItem | null {
  const extractedNames = new Set(extracted.fields.map(f => f.fieldName));
  if (extractedNames.size === 0) return null;

  let best: TableItem | null = null;
  let bestRatio = 0;

  for (const existing of candidates) {
    const existingNames = new Set(existing.fields.map(f => f.fieldName));
    let overlap = 0;
    for (const name of extractedNames) {
      if (existingNames.has(name)) overlap++;
    }
    const union = new Set([...extractedNames, ...existingNames]).size;
    const ratio = union > 0 ? overlap / union : 0;

    if (ratio > bestRatio && ratio >= STRUCT_MATCH_THRESHOLD) {
      bestRatio = ratio;
      best = existing;
    }
  }

  return best;
}

function findStructuralStateMatch(
  extracted: ExtractedState,
  candidates: StateItem[],
): StateItem | null {
  const extractedVals = new Set(extracted.stateValues);
  if (extractedVals.size === 0) return null;

  let best: StateItem | null = null;
  let bestRatio = 0;

  for (const existing of candidates) {
    const existingVals = new Set(existing.stateValues);
    let overlap = 0;
    for (const v of extractedVals) {
      if (existingVals.has(v)) overlap++;
    }
    const union = new Set([...extractedVals, ...existingVals]).size;
    const ratio = union > 0 ? overlap / union : 0;

    if (ratio > bestRatio && ratio >= STRUCT_MATCH_THRESHOLD) {
      bestRatio = ratio;
      best = existing;
    }
  }

  return best;
}

// ===== Field/value replacement =====

/**
 * Full replacement: extracted fields are authoritative.
 * Carry over id/isPrimaryKey/relatedState from name-matched existing fields.
 */
function replaceTableFields(existing: TableField[], extracted: ExtractedTable['fields']): TableField[] {
  const existingMap = new Map(existing.map(f => [f.fieldName, f]));

  return extracted.map(ef => {
    const prev = existingMap.get(ef.fieldName);
    if (prev) {
      return {
        ...prev,
        fieldType: ef.fieldType,
        description: ef.description || prev.description,
        isRequired: ef.isRequired,
      };
    }
    return {
      id: uuidv4(),
      fieldName: ef.fieldName,
      fieldType: ef.fieldType,
      description: ef.description,
      isRequired: ef.isRequired,
      relatedState: '',
    };
  });
}

/**
 * Full replacement for enum values: extracted is authoritative.
 * Carry over value from name-matched existing entries.
 */
function replaceEnumValues(existing: StateEnumValue[], extracted: StateEnumValue[]): StateEnumValue[] {
  const existingMap = new Map(existing.map(e => [e.key, e.value]));
  return extracted.map(e => ({
    key: e.key,
    value: e.value || existingMap.get(e.key) || '',
  }));
}

// ===== Core merge =====

export function computeMergeActions(
  existingStates: StateItem[],
  existingTables: TableItem[],
  extractedStates: ExtractedState[],
  extractedTables: ExtractedTable[],
  sourceNodeId?: string,
): MergeResult {
  const actions: MergeAction[] = [];
  let addedStates = 0, updatedStates = 0;
  let addedTables = 0, updatedTables = 0;

  // Track which existing items have been matched
  const matchedStateIds = new Set<string>();
  const matchedTableIds = new Set<string>();
  const processedExtracted = { states: new Set<string>(), tables: new Set<string>() };

  const stateByName = new Map(existingStates.map(s => [s.stateName, s]));
  const tableByName = new Map(existingTables.map(t => [t.tableName, t]));

  // --- States ---
  for (const es of extractedStates) {
    if (processedExtracted.states.has(es.stateName)) continue;
    processedExtracted.states.add(es.stateName);

    // Pass 1: exact name match
    let matched = stateByName.get(es.stateName);
    if (matched) {
      matchedStateIds.add(matched.id);
      if (stateValuesChanged(matched, es)) {
        const enumVals = replaceEnumValues(
          matched.enumValues || [],
          es.enumValues || es.stateValues.map(v => ({ key: v, value: '' })),
        );
        actions.push({
          type: 'UPDATE_STATE',
          payload: {
            ...matched,
            stateValues: enumVals.map(e => e.key),
            enumValues: enumVals,
            description: es.description || matched.description,
          },
        });
        updatedStates++;
      }
      continue;
    }

    // Pass 2: structural match among unmatched existing states
    const unmatchedStates = existingStates.filter(s => !matchedStateIds.has(s.id));
    const structural = findStructuralStateMatch(es, unmatchedStates);
    if (structural) {
      matchedStateIds.add(structural.id);
      const enumVals = replaceEnumValues(
        structural.enumValues || [],
        es.enumValues || es.stateValues.map(v => ({ key: v, value: '' })),
      );
      actions.push({
        type: 'UPDATE_STATE',
        payload: {
          ...structural,
          stateName: es.stateName,
          stateValues: enumVals.map(e => e.key),
          enumValues: enumVals,
          description: es.description || structural.description,
        },
      });
      updatedStates++;
      continue;
    }

    // Pass 3: genuinely new
    const relDocs = sourceNodeId ? [sourceNodeId] : [];
    actions.push({
      type: 'ADD_STATE',
      payload: {
        id: uuidv4(),
        stateName: es.stateName,
        stateValues: es.stateValues,
        enumValues: es.enumValues || es.stateValues.map(v => ({ key: v, value: '' })),
        description: es.description,
        relatedDocs: relDocs,
        relatedTables: [],
      },
    });
    addedStates++;
  }

  // --- Tables ---
  for (const et of extractedTables) {
    if (processedExtracted.tables.has(et.tableName)) continue;
    processedExtracted.tables.add(et.tableName);

    // Pass 1: exact name match
    let matched = tableByName.get(et.tableName);
    if (matched) {
      matchedTableIds.add(matched.id);
      if (tableFieldsChanged(matched, et)) {
        actions.push({
          type: 'UPDATE_TABLE',
          payload: {
            ...matched,
            description: et.description || matched.description,
            fields: replaceTableFields(matched.fields, et.fields),
          },
        });
        updatedTables++;
      }
      continue;
    }

    // Pass 2: structural match among unmatched existing tables
    const unmatchedTables = existingTables.filter(t => !matchedTableIds.has(t.id));
    const structural = findStructuralTableMatch(et, unmatchedTables);
    if (structural) {
      matchedTableIds.add(structural.id);
      actions.push({
        type: 'UPDATE_TABLE',
        payload: {
          ...structural,
          tableName: et.tableName,
          description: et.description || structural.description,
          fields: replaceTableFields(structural.fields, et.fields),
        },
      });
      updatedTables++;
      continue;
    }

    // Pass 3: genuinely new table
    const relDocs = sourceNodeId ? [sourceNodeId] : [];
    actions.push({
      type: 'ADD_TABLE',
      payload: {
        id: uuidv4(),
        tableName: et.tableName,
        description: et.description,
        fields: et.fields.map(f => ({
          id: uuidv4(),
          fieldName: f.fieldName,
          fieldType: f.fieldType,
          description: f.description,
          isRequired: f.isRequired,
          relatedState: '',
        })),
        relatedDocs: relDocs,
      },
    });
    addedTables++;
  }

  return {
    actions,
    added: { states: addedStates, tables: addedTables },
    updated: { states: updatedStates, tables: updatedTables },
  };
}

export function formatMergeMessage(result: MergeResult): string | null {
  const parts: string[] = [];
  if (result.added.states > 0) parts.push(`新增 ${result.added.states} 个状态`);
  if (result.updated.states > 0) parts.push(`更新 ${result.updated.states} 个状态`);
  if (result.added.tables > 0) parts.push(`新增 ${result.added.tables} 个表`);
  if (result.updated.tables > 0) parts.push(`更新 ${result.updated.tables} 个表`);
  return parts.length > 0 ? parts.join('、') : null;
}
