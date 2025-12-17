import * as vscode from "vscode";
import { ActivityItem } from "../models/activity";

export class ActivityTreeItem extends vscode.TreeItem {
  constructor(public readonly activity: ActivityItem) {
    super(activity.url, vscode.TreeItemCollapsibleState.None);

    this.description = timeAgo(activity.timestamp);
    this.contextValue = "activityItem";

    this.iconPath = methodIcon(activity.method);

    this.command = {
      command: "watchapi.activity.open",
      title: "Open Request",
      arguments: [activity],
    };
  }
}

function methodIcon(method: string) {
  return new vscode.ThemeIcon(
    method === "GET" ? "arrow-right" : "cloud-upload",
  );
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  return days === 0 ? "today" : `${days} days ago`;
}
