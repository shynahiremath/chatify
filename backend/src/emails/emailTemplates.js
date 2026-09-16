export function createWelcomeEmailTemplate(name, clientURL) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Messenger</title>
  </head>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f0f2f5;">

    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
      <div style="width: 64px; height: 64px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: inline-block; line-height: 64px; margin-bottom: 12px;">
        <span style="font-size: 28px;">💬</span>
      </div>
      <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -0.5px;">Welcome to Messenger!</h1>
    </div>

    <div style="background-color: #ffffff; padding: 35px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
      <p style="font-size: 18px; margin: 0 0 12px;"><strong style="color: #5B86E5;">Hello ${name},</strong> 👋</p>
      <p style="margin: 0 0 20px; color: #444;">We're excited to have you join our messaging platform! Messenger connects you with friends, family, and colleagues in real-time, no matter where they are.</p>

      <div style="background-color: #f8f9ff; border-radius: 10px; margin: 25px 0; border-left: 4px solid #36D1DC; padding: 25px;">
        <p style="font-size: 16px; margin: 0 0 15px;"><strong>Get started in just a few steps:</strong></p>
        <ul style="padding-left: 20px; margin: 0;">
          <li style="margin-bottom: 10px;">Set up your profile picture</li>
          <li style="margin-bottom: 10px;">Find and add your contacts</li>
          <li style="margin-bottom: 10px;">Start a conversation</li>
          <li style="margin-bottom: 0;">Share photos, videos, and more</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${clientURL}" style="background: linear-gradient(to right, #36D1DC, #5B86E5); color: white; text-decoration: none; padding: 14px 36px; border-radius: 50px; font-weight: 500; display: inline-block; box-shadow: 0 4px 14px rgba(91,134,229,0.4);">Open Messenger</a>
      </div>

      <p style="margin-bottom: 5px;">If you need any help or have questions, we're always here to assist you.</p>
      <p style="margin-top: 0;">Happy messaging!</p>

      <p style="margin-top: 25px; margin-bottom: 0;">Best regards,<br/>The Messenger Team</p>
    </div>

    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
      <p>© 2025 Messenger. All rights reserved.</p>
      <p>
        <a href="#" style="color: #5B86E5; text-decoration: none; margin: 0 10px;">Privacy Policy</a>
        <a href="#" style="color: #5B86E5; text-decoration: none; margin: 0 10px;">Terms of Service</a>
        <a href="#" style="color: #5B86E5; text-decoration: none; margin: 0 10px;">Contact Us</a>
      </p>
    </div>

  </body>
  </html>
  `;
}