import { platform } from 'node:os'
import notifier from 'node-notifier'
import { DaemonClient, type DaemonMessage } from './daemon-client'
import { log } from './logger'
import { playSound } from './sound'
import type { TranscriptInfo } from './transcript'

export async function sendNotification(
  hookType: string,
  transcriptInfo: TranscriptInfo,
): Promise<void> {
  if (platform() === 'darwin') {
    log(
      `Hook ${hookType}: pid=${process.pid}, ppid=${process.ppid}, sessionId=${transcriptInfo.sessionId}`,
    )

    const daemonMessage: DaemonMessage = {
      type: 'hook',
      hookType,
      sessionId: transcriptInfo.sessionId,
      pid: process.ppid || process.pid,
      cwd: transcriptInfo.cwd,
      message: transcriptInfo.message,
      timestamp: Date.now(),
    }

    const socketClient = new DaemonClient()
    await socketClient.sendMessage(daemonMessage)
  } else {
    if (hookType === 'Stop' || hookType === 'Notification') {
      const displayCwd = transcriptInfo.cwd.replace(process.env.HOME || '', '~')

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          notifier.notify(
            {
              title: 'Claude Code',
              message: `${displayCwd}\n\n${transcriptInfo.message.length > 200 ? `${transcriptInfo.message.substring(0, 197)}...` : transcriptInfo.message}`,
              sound: false,
              wait: true,
            },
            (err) => {
              if (err) {
                log('Notification error:', err)
                reject(err)
              } else {
                resolve()
              }
            },
          )
        }),
        playSound(),
      ])
    }
  }
}
