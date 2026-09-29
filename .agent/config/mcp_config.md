# Cấu hình MCP

> Template an toàn để cấu hình MCP server cho Backlog, tài liệu nguồn, Figma và Playwright.

## Mục đích

File này cung cấp mẫu cấu hình MCP dùng chung cho kit. Không lưu token thật trong file này.

## Khi Nào Dùng

| Trường hợp | Cách dùng |
|---|---|
| Cần đọc tài liệu nguồn | Tài liệu nay nằm ở Obsidian vault / file Markdown trong task folder — không qua MCP. Backlog dùng REST riêng (`scripts/integrations/backlog/`). |
| Cần đọc Figma design | Dùng server `figma`. |
| Cần inspect UI qua browser | Dùng server `playwright`. |
| Cần cấu hình local có secret | Lưu trong `.env.local`, `.env` hoặc MCP settings local của IDE. |

## Template

```json
{
  "mcpServers": {
    "atlassian": {
      "command": "npx.cmd",
      "args": [
        "-y",
        "mcp-atlassian"
      ],
      "env": {
        "BACKLOG_URL": "${BACKLOG_URL}",
        "BACKLOG_USERNAME": "${BACKLOG_USERNAME}",
        "BACKLOG_API_KEY": "${BACKLOG_API_KEY}",
        "DOC_URL": "${DOC_URL}",
        "DOC_USERNAME": "${DOC_USERNAME}",
        "DOC_API_TOKEN": "${DOC_API_TOKEN}"
      }
    },
    "figma": {
      "command": "npx.cmd",
      "args": [
        "-y",
        "@tmegit/figma-developer-mcp",
        "--stdio"
      ],
      "env": {
        "FIGMA_API_KEY": "${FIGMA_API_KEY}"
      }
    },
    "playwright": {
      "command": "npx.cmd",
      "args": [
        "-y",
        "@playwright/mcp"
      ]
    }
  }
}
```

## Server

| Server | Mục đích | Package |
|---|---|---|
| — | Không còn MCP server nào cho bug tracking/tài liệu: Backlog đi qua REST riêng, tài liệu đọc từ Markdown trong task folder. | — |
| `figma` | Đọc Figma để phân tích UI, flow và hỗ trợ sinh testcase/locator. | `@tmegit/figma-developer-mcp` |
| `playwright` | Inspect UI và hỗ trợ browser automation qua MCP. | `@playwright/mcp` |

## Setup Local

1. Copy key cần thiết từ `.env.example` sang `.env.local` hoặc `.env`.
2. Đặt Backlog, tài liệu nguồn và Figma token thật trong file local hoặc MCP settings của IDE.
3. Copy JSON template phía trên vào cấu hình MCP local.
4. Nếu IDE không tự expand `${...}`, thay placeholder bằng local env value trong cấu hình local, không sửa file template này.

## Rules

- Không commit token, password, cookie, private key hoặc service-account JSON.
- Không hardcode secret vào Markdown dùng chung.
- Thêm MCP server mới thì phải là package đã được team review. MCP server có quyền đọc dữ liệu thật, nên
  package lạ là đường rò dữ liệu chứ không phải chuyện tiện tay.
- Server nào chạm dữ liệu khách thì chỉ dùng tài khoản TEST, không dùng production khi chưa có approval riêng.
- Nếu cần ghi chú cấu hình local có secret, tạo `.agent/config/mcp_config.local.md`; file local này phải nằm ngoài Git.
- Nếu token từng bị commit hoặc chia sẻ, phải rotate token trong provider console.

## References

| Document | Purpose |
|---|---|
| [README.md](../../README.md) | Landing page của kit. |
| [RULE_GLOBAL.md](../../RULE_GLOBAL.md) | Rule vận hành chung. |
