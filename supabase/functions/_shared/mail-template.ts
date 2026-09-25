const BADGE_URL = "https://econmind.group/brand/econmind-badge-96.png";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

/** HTML counterpart to the unchanged plain-text message sent through Brevo. */
export function renderAdminMailHtml(message: string, senderName: string): string {
  const body = escapeHtml(message).replace(/\r\n|\r|\n/g, "<br>");
  const sender = escapeHtml(senderName);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>EconMind</title></head>
<body style="margin:0;padding:0;background:#f2f5f3;color:#172621;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f2f5f3;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #dce4df;border-radius:16px;">
      <tr><td style="padding:28px 32px;background:#102b27;border-radius:16px 16px 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:16px;vertical-align:middle;"><img src="${BADGE_URL}" width="56" height="56" alt="EconMind badge" style="display:block;width:56px;height:56px;border:0;"></td>
          <td style="vertical-align:middle;"><span style="display:block;color:#ffffff;font-size:23px;font-weight:700;letter-spacing:-.5px;">EconMind</span><span style="display:block;padding-top:5px;color:#c6d9d0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Official correspondence</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:24px 32px 0;font-size:12px;line-height:20px;color:#66776f;">FROM<br><strong style="color:#172621;font-size:14px;">${sender} · EconMind</strong><br><a href="mailto:admin@econmind.group" style="color:#17664f;text-decoration:underline;">admin@econmind.group</a></td></tr>
      <tr><td style="padding:28px 32px 40px;font-size:15px;line-height:25px;color:#172621;overflow-wrap:anywhere;word-break:break-word;">${body}</td></tr>
      <tr><td style="border-top:1px solid #e7ece8;padding:20px 32px 26px;color:#66776f;font-size:12px;line-height:20px;">
        Sent by EconMind · <a href="mailto:admin@econmind.group" style="color:#17664f;text-decoration:underline;">admin@econmind.group</a><br>
        <a href="https://econmind.group/" style="color:#17664f;text-decoration:underline;">econmind.group</a>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}
