// providers/activity-provider.ts
import * as vscode from "vscode";
import { ActivityTreeItem } from "./activity-tree-item";
import { ActivityStore } from "../storage/activity-store";

export class ActivityProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private store: ActivityStore) {}

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(el: ActivityTreeItem) {
    return el;
  }

  getChildren(): vscode.TreeItem[] {
    if (this.store.getAll().length === 0) {
      return [new vscode.TreeItem("No activity yet")];
    }

    return this.store.getAll().map((item) => new ActivityTreeItem(item));
  }
}
