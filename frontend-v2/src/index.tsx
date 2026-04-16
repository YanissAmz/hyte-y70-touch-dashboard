/* @refresh reload */
import { render } from "solid-js/web";
import { App } from "./App";
import "./app.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
render(() => <App />, root);
