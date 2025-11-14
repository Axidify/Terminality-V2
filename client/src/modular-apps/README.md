Modular Apps Plugin API (Experimental)

This folder contains an experimental plugin system for creating modular desktop apps that can be installed/uninstalled and hosted in the main window manager. It's currently a lightweight API with the following contract:

- Manifest: export a `ModularAppManifest` describing `id`, `name`, `description`, `version`, `component`.
- Registering: The `PluginManagerProvider` auto-registers built-in plugins declared in `registerPlugins.ts`. External plugins can call `register` exported by the plugin manager or add new entries to the registry.
- Installing: Calling `install(id)` stores the plugin id in `desktop.installedTools` (persisted via `saveService`) and makes the plugin available for opening from the modular apps UI.
- Hosting: Plugins are rendered inside the `PluginHost` window which receives `pluginId` as a payload and resolves the component.

This is intentionally small so the host can be expanded later with sandboxing, permissions, and remote installers.

## Built-in: Online Chat (MVP)

- The built-in plugin `online-chat` is registered via `registerPlugins.ts`.
- You can launch it from:
	- Desktop icon: "Online Chat" (opens the plugin host with `pluginId: online-chat`).
	- Start menu: "Online Chat" entry under the Start menu.
	- Programmatically: `wm.open('modular-plugin', { title: 'Online Chat', payload: { pluginId: 'online-chat' } })`.
  
Notes: This MVP uses polling and in-memory messages on the server for now.
