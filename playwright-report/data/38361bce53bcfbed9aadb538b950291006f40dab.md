# Page snapshot

```yaml
- heading "Claude Code UI" [level=1]
- paragraph: AI coding assistant interface
- button "Refresh projects and sessions (Ctrl+R)"
- button "Add existing project (Ctrl+N)"
- textbox "Search projects...": testuser
- button
- heading "No matching projects" [level=3]
- paragraph: Try adjusting your search term
- button "Tools Settings"
- img
- heading "Choose Your Project" [level=2]
- paragraph: Select a project from the sidebar to start coding with Claude. Each project contains your chat sessions and file history.
- paragraph:
  - text: 💡
  - strong: "Tip:"
  - text: Create a new project by clicking the folder icon in the sidebar
- button "Open settings panel"
- heading "Quick Settings" [level=3]
- heading "Appearance" [level=4]
- text: Dark Mode
- switch "Toggle dark mode":
  - text: Toggle dark mode
  - img
- heading "Tool Display" [level=4]
- text: Auto-expand tools
- checkbox "Auto-expand tools"
- text: Show raw parameters
- checkbox "Show raw parameters"
- heading "View Options" [level=4]
- text: Auto-scroll to bottom
- checkbox "Auto-scroll to bottom" [checked]
- heading "Input Settings" [level=4]
- text: Send by Ctrl+Enter
- checkbox "Send by Ctrl+Enter"
- paragraph: When enabled, pressing Ctrl+Enter will send the message instead of just Enter. This is useful for IME users to avoid accidental sends.
```