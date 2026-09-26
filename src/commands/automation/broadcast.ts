import type { Command } from '../../types/command.js';
import { broadcastManager } from '../../services/broadcast/index.js';
import { countSpintaxVariations } from '../../utils/spintax.js';

const broadcastCommand: Command = {
  name: 'broadcast',
  aliases: ['bc'],
  description: 'Manage and dispatch anti-ban bulk broadcast campaigns with Spintax',
  category: 'automation',
  ownerOnly: true,
  execute: async ({ m, args, text }) => {
    const sub = args[0]?.toLowerCase();

    // 1. Status Check
    if (sub === 'status') {
      const { currentJob } = broadcastManager.getStatus();
      if (!currentJob) {
        await m.reply('Tidak ada kampanye broadcast yang sedang berjalan atau terjadwal.');
        return;
      }

      const percent =
        currentJob.totalTargets > 0
          ? Math.round((currentJob.currentIndex / currentJob.totalTargets) * 100)
          : 0;

      const startedStr = currentJob.startedAt
        ? new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(currentJob.startedAt))
        : '-';

      const lines = [
        `[Status Kampanye Broadcast]`,
        `ID: ${currentJob.id}`,
        `Status: ${currentJob.status.toUpperCase()}`,
        `Kemajuan: ${currentJob.currentIndex} / ${currentJob.totalTargets} (${percent}%)`,
        `Terkirim: ${currentJob.sentCount}`,
        `Gagal: ${currentJob.failedCount}`,
        `Waktu Mulai: ${startedStr} WIB`,
        `Pacing: ${currentJob.config.minDelayMs / 1000}s - ${currentJob.config.maxDelayMs / 1000}s`,
        `Jeda Istirahat: ${currentJob.config.batchDelayMs / 1000}s tiap ${currentJob.config.batchSize} pesan`,
      ];

      await m.reply(lines.join('\n'));
      return;
    }

    // 2. Pause
    if (sub === 'pause') {
      const ok = broadcastManager.pauseBroadcast();
      await m.reply(
        ok
          ? 'Kampanye broadcast berhasil dijeda. Ketik /bc resume untuk melanjutkan.'
          : 'Tidak ada broadcast aktif yang dapat dijeda.'
      );
      return;
    }

    // 3. Resume
    if (sub === 'resume') {
      const ok = broadcastManager.resumeBroadcast();
      await m.reply(
        ok
          ? 'Kampanye broadcast dilanjutkan kembali.'
          : 'Tidak ada broadcast dalam status jeda.'
      );
      return;
    }

    // 4. Cancel
    if (sub === 'cancel') {
      const ok = broadcastManager.cancelBroadcast();
      await m.reply(
        ok
          ? 'Kampanye broadcast berhasil dibatalkan.'
          : 'Tidak ada broadcast aktif yang dapat dibatalkan.'
      );
      return;
    }

    // 5. Dispatch New Broadcast: /bc <targets> | <template>
    if (text.includes('|')) {
      const [targetsPart, ...templateParts] = text.split('|');
      const template = templateParts.join('|').trim();

      if (!template) {
        await m.reply('Template pesan tidak boleh kosong setelah tanda pemisah "|".');
        return;
      }

      // Extract phone numbers separated by comma, space, or newline
      const targetNumbers = targetsPart
        .replace(/^\s*(broadcast|bc)\s+/i, '')
        .split(/[\s,;\n]+/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 8);

      if (targetNumbers.length === 0) {
        await m.reply('Tidak ada nomor tujuan valid yang ditemukan sebelum tanda "|".');
        return;
      }

      const totalVariations = countSpintaxVariations(template);

      try {
        const job = await broadcastManager.startBroadcast({
          targets: targetNumbers,
          template,
        });

        const lines = [
          `[Kampanye Broadcast Dimulai]`,
          `ID: ${job.id}`,
          `Total Penerima: ${job.totalTargets} kontak`,
          `Variasi Spintax: ${totalVariations} kombinasi unik`,
          `Pacing Anti-Ban: ${job.config.minDelayMs / 1000}s - ${job.config.maxDelayMs / 1000}s acak`,
          `Jeda Otomatis: ${job.config.batchDelayMs / 1000}s tiap ${job.config.batchSize} pesan`,
          ``,
          `Ketik /bc status untuk memantau kemajuan atau /bc cancel untuk membatalkan.`,
        ];

        await m.reply(lines.join('\n'));
      } catch (err: unknown) {
        await m.reply(`Gagal memulai broadcast: ${(err as Error).message}`);
      }
      return;
    }

    // 6. Help / Usage Guide
    const usage = [
      `[Panduan Perintah Broadcast]`,
      `1. Memulai Pengiriman:`,
      `/bc <nomor1,nomor2,...> | <template dengan spintax>`,
      `Contoh:`,
      `/bc 0812345678,0851663280 | {Halo|Hai} {kak|bunda}, promo hari ini hemat hingga 50%!`,
      ``,
      `2. Kontrol & Pemantauan:`,
      `- /bc status : Cek kemajuan pengiriman`,
      `- /bc pause  : Menjeda antrean sementara`,
      `- /bc resume : Melanjutkan antrean yang dijeda`,
      `- /bc cancel : Membatalkan pengiriman aktif`,
    ].join('\n');

    await m.reply(usage);
  },
};

export default broadcastCommand;
