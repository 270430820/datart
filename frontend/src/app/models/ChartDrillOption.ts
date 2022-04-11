/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ChartDataSectionField, FilterCondition } from 'app/types/ChartConfig';
import { FilterSqlOperator } from 'globalConstants';
import { isEmptyArray } from 'utils/object';
import { ConditionBuilder } from './ChartFilterCondition';

export enum DrillMode {
  Normal = 'normal',
  Drill = 'drill',
  Expand = 'expand',
}

export class ChartDrillOption {
  private cursor: number = -1;
  private mode: DrillMode = DrillMode.Normal;
  private isSelected = false;
  private drillFields: ChartDataSectionField[] = [];
  private drillDownFields: Array<{
    field: ChartDataSectionField;
    condition?: FilterCondition;
  }> = [];
  private expandDownFields: Array<{
    field: ChartDataSectionField;
    condition?: FilterCondition;
  }> = [];

  constructor(fields: ChartDataSectionField[]) {
    this.drillFields = fields;
  }

  public getMode() {
    if (!isEmptyArray(this.drillDownFields)) {
      return DrillMode.Drill;
    } else if (!isEmptyArray(this.expandDownFields)) {
      return DrillMode.Expand;
    }
    return this.mode;
  }

  public toggleSelectedDrill() {
    this.isSelected = !this.isSelected;
  }

  public isSelectedDrill() {
    return this.isSelected;
  }

  public getAllDrillFields() {
    return this.drillFields;
  }

  public getDrillFields() {
    return this.drillDownFields;
  }

  public getFields(): ChartDataSectionField[] | undefined {
    return this.cursor === -1
      ? undefined
      : this.getMode() === DrillMode.Drill
      ? [this.drillFields?.[this.cursor + 1]]
      : this.drillFields.slice(0, this.cursor + 2);
  }

  public drillDown(filterData?: { [key in string]: any }) {
    if (this.drillFields.length === this.cursor + 2) {
      return;
    }
    this.cursor++;
    const currentField = this.drillFields[this.cursor];
    let cond;
    if (currentField && filterData) {
      cond = new ConditionBuilder()
        .setName(currentField.colName)
        .setOperator(FilterSqlOperator.Equal)
        .setValue(filterData[currentField.colName])
        .asFilter();
    }
    this.drillDownFields.push({
      field: currentField,
      condition: cond,
    });
  }

  public expandDown() {
    if (this.drillFields.length === this.cursor + 2) {
      return;
    }
    this.cursor++;
    const currentField = this.drillFields[this.cursor];
    this.expandDownFields.push({
      field: currentField,
    });
  }

  public drillUp(field?: ChartDataSectionField) {
    if (field) {
      const fieldIndex = this.drillDownFields.findIndex(
        d => d.field.uid === field.uid,
      );
      if (fieldIndex === 0) {
        this.clearAll();
      } else if (fieldIndex >= 1) {
        this.drillDownFields = this.drillDownFields.slice(0, fieldIndex);
        this.cursor = fieldIndex - 1;
      }
    } else {
      this.cursor--;
      this.drillDownFields.pop();
    }
  }

  public expandUp(field?: ChartDataSectionField) {
    if (field) {
      const fieldIndex = this.expandDownFields.findIndex(
        d => d.field.uid === field.uid,
      );
      if (fieldIndex === 0) {
        this.clearAll();
      } else if (fieldIndex >= 1) {
        this.expandDownFields = this.expandDownFields.slice(0, fieldIndex);
        this.cursor = fieldIndex - 1;
      }
    } else {
      this.cursor--;
      this.expandDownFields.pop();
    }
  }

  private clearAll() {
    this.cursor = -1;
    this.mode = DrillMode.Normal;
    this.drillDownFields = [];
    this.expandDownFields = [];
  }
}
