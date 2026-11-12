/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
export type EmailTheme = 'default' | 'festive' | 'luxury' | 'neon' | 'minimal';

export interface EmailOptions {
  themeColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  includeSurveyButton?: boolean;
  surveyButtonText?: string;
  surveyButtonFontSize?: number;
  surveyLink?: string;
  eventDate?: string;
  eventTime?: string;
  youtubeLink?: string;
}

export function getEmailHtml(theme: EmailTheme, eventName: string, bodyText: string, options?: EmailOptions) {
  const primary = options?.themeColor || '#2563eb';
  const secondary = options?.secondaryColor || primary;
  const accent = options?.accentColor || primary;


  const hexOpacity = (hex: string, opacity: number) => {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const a = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return `#${hex}${a}`;
  };

  const themes = {
    minimal: {
      bg: '#ffffff',
      containerBg: '#ffffff',
      color: '#1e293b',
      headerBg: '#ffffff',
      headerColor: primary,
      borderColor: '#e2e8f0',
      headerBorder: `1px solid ${primary}`,
      buttonBg: primary,
      buttonColor: '#ffffff',
    },
    default: {
      bg: '#f8fafc',
      containerBg: '#ffffff',
      color: '#334155',
      headerBg: primary,
      headerColor: '#ffffff',
      borderColor: '#e2e8f0',
      headerBorder: 'none',
      buttonBg: primary,
      buttonColor: '#ffffff',
    },
    festive: {
      bg: hexOpacity(secondary, 0.1),
      containerBg: '#ffffff',
      color: secondary,
      headerBg: secondary,
      headerColor: '#ffffff',
      borderColor: hexOpacity(secondary, 0.2),
      headerBorder: 'none',
      buttonBg: secondary,
      buttonColor: '#ffffff',
    },
    luxury: {
      bg: '#0F0F0F',
      containerBg: '#1A1A1A',
      color: '#E0E0E0',
      headerBg: accent,
      headerColor: '#000000',
      borderColor: '#333333',
      headerBorder: 'none',
      buttonBg: accent,
      buttonColor: '#000000',
    },
    neon: {
      bg: '#09090B',
      containerBg: '#18181B',
      color: '#e4e4e7',
      headerBg: '#000000',
      headerColor: accent,
      borderColor: accent,
      headerBorder: `2px solid ${accent}`,
      buttonBg: accent,
      buttonColor: '#ffffff',
    }
  };

  const t = themes[theme] || themes.default;
  const formattedBody = bodyText.replace(/\n/g, '<br/>');

  let formattedEventDate = '';
  if (options?.eventDate) {
    try {
      const dateObj = new Date(options.eventDate);
      if (!isNaN(dateObj.getTime())) {
        const thaiMonths = [
          "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
          "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
        ];
        const day = dateObj.getDate();
        const month = thaiMonths[dateObj.getMonth()];
        const year = dateObj.getFullYear() + 543;
        formattedEventDate = `${day} ${month} ${year}`;
      } else {
        formattedEventDate = options.eventDate;
      }
    } catch(e) {
      formattedEventDate = options.eventDate;
    }
  }

  const countdownHtml = options?.eventDate ? `
    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed currentColor; opacity: 0.95; text-align: center;">
      <span style="display: block; font-size: 15px; font-weight: bold; margin-bottom: 4px;">เปิดให้ทำแบบประเมินภายในวันกิจกรรมเท่านั้น</span>
      <span style="display: block; font-size: 13px; font-weight: normal; margin-bottom: 12px; opacity: 0.9;">Evaluation is open on the event day only</span>
      <div style="display: block; background-color: rgba(0,0,0,0.1); padding: 12px 10px; border-radius: 8px; box-sizing: border-box; width: 100%;">
        <span style="display: block; font-size: 13px; font-weight: normal; margin-bottom: 4px; opacity: 0.85;">วันที่จัดกิจกรรม / Event Date</span>
        <span style="display: block; font-size: 15px; font-weight: bold; letter-spacing: 0.5px; line-height: 1.4; word-break: break-word;">${formattedEventDate}${options.eventTime ? ` เวลา / Time ${options.eventTime} น.` : ''}</span>
      </div>
    </div>
  ` : '';

  const surveyTextRaw = options?.surveyButtonText || 'ทำแบบประเมินความพึงพอใจ';
  const surveyText = surveyTextRaw.replace(/\n/g, '<br/>');
  const btnFontSize = Math.min(options?.surveyButtonFontSize || 22, 24); // Cap max size just in case
  
  let buttonsHtml = '';
  if (options?.includeSurveyButton) {
    buttonsHtml = `
      <a href="${options?.surveyLink || '#'}" style="display: block; width: 100%; max-width: 380px; margin: 0 auto; box-sizing: border-box; background-color: ${t.buttonBg}; color: ${t.buttonColor}; text-decoration: none; padding: 20px 16px; border-radius: 12px; font-weight: bold; font-size: 18px; line-height: 1.3; box-shadow: 0 6px 0 rgba(0,0,0,0.15), 0 10px 20px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.1); border-bottom: 4px solid rgba(0,0,0,0.2); text-shadow: 0 1px 2px rgba(0,0,0,0.2); cursor: pointer;">
        <span style="display: block; font-size: ${btnFontSize}px; word-break: break-word;">${surveyText}</span>
      </a>
    `;
  }

  const surveyHtml = options?.includeSurveyButton ? `
      <div style="text-align: center; margin-top: 30px;">
        ${buttonsHtml}
        ${countdownHtml}
      </div>
  ` : '';

  let youtubeHtml = '';
  if (options?.youtubeLink) {
    const extractYoutubeId = (url: string) => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : null;
    };
    const videoId = extractYoutubeId(options.youtubeLink);
    if (videoId) {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      youtubeHtml = `
      <div style="margin-top: 30px; text-align: center;">
        <p style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: ${t.color};">
          🔽 ด้านล่างนี้คือวิดีโอเชิญชวนจากศิลปิน (คลิกเพื่อชม ระบบจะเปิดหน้าต่างใหม่บน YouTube) 🔽
        </p>
        <a href="${watchUrl}" target="_blank" style="display: block; text-decoration: none; position: relative;">
          <!-- Fallback table/div structure for play button overlay in email clients -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 500px; margin: 0 auto;">
            <tr>
              <td style="position: relative; background-image: url('${thumbnailUrl}'); background-size: cover; background-position: center; border-radius: 12px; border: 2px solid ${t.borderColor}; height: 280px; text-align: center; vertical-align: middle;">
                <!--[if mso]>
                <v:image xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style=" border: 0;display: inline-block; width: 500px; height: 280px;" src="${thumbnailUrl}" />
                <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style=" border: 0;display: inline-block;position: absolute; width: 500px; height: 280px;">
                <v:fill opacity="0%" color="#000000" />
                <v:textbox inset="0,0,0,0">
                <![endif]-->
                <div>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_play_button_icon_%282013%E2%80%932017%29.svg" alt="Play" width="60" height="42" style="display: inline-block; margin: 0 auto;" />
                </div>
                <!--[if mso]>
                </v:textbox>
                </v:rect>
                <![endif]-->
              </td>
            </tr>
          </table>
        </a>
        <p style="font-size: 12px; margin-top: 12px; color: ${t.color}; opacity: 0.8;">
          เมื่อชมวิดีโอจบแล้ว ท่านสามารถกดปุ่ม "ย้อนกลับ" หรือ "ปิดหน้าต่าง YouTube" เพื่อกลับมาดูตั๋วที่หน้านี้ได้ตลอดเวลาครับ
        </p>
      </div>
      `;
    }
  }

  const lineOAHtml = `
      <div style="text-align: center; margin-top: 40px; padding-top: 25px; border-top: 1px dashed ${t.borderColor};">
        <p style="font-size: 14px; font-weight: bold; margin-bottom: 12px; line-height: 1.5; color: ${t.color};">
          พบปัญหา/มีข้อสงสัยเสนอแนะ/สอบถามข้อมูลทั่วไป<br/>เกี่ยวกับระบบหรือการชำระ สแกนหรือกดที่คิวอาร์โค้ด
        </p>
        <a href="https://line.me/R/ti/p/@792zqqbw" target="_blank" style="display: inline-block;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://line.me/R/ti/p/@792zqqbw" alt="LINE OA digitecteam" style="width: 120px; height: 120px; border: 1px solid ${t.borderColor}; border-radius: 8px; padding: 5px; background: #ffffff;" />
        </a>
        <div style="margin-top: 15px;">
          <a href="https://line.me/R/ti/p/@792zqqbw" target="_blank" style="display: inline-block; background-color: #00B900; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            พูดคุยกับแอดมินทาง LINE (digitecteam)
          </a>
        </div>
      </div>
  `;

  return `
  <div style="background-color: ${t.bg}; padding: 20px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${t.color}; min-height: 100vh;">
    <div style="max-width: 600px; margin: 0 auto; background-color: ${t.containerBg}; border: 1px solid ${t.borderColor}; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); width: 100%; box-sizing: border-box;">
      <div style="background-color: ${t.headerBg}; color: ${t.headerColor}; padding: 25px 20px; text-align: center; border-bottom: ${t.headerBorder};">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; word-break: break-word;">${eventName}</h1>
      </div>
      <div style="padding: 30px 20px; font-size: 16px; line-height: 1.8; box-sizing: border-box; word-break: break-word;">
        ${formattedBody}
        ${youtubeHtml}
        ${surveyHtml}
        ${lineOAHtml}
      </div>
      <div style="background-color: ${t.bg}; padding: 30px; text-align: center; border-top: 1px solid ${t.borderColor}; font-size: 13px; color: ${t.color}; opacity: 0.7;">
        <p style="margin: 0;">This email and any attached QR codes are your official access passes.</p>
        <p style="margin: 8px 0 0 0;">Please prepare your QR code at the entrance.</p>
      </div>
    </div>
  </div>
  `;
}
