(async () => {
  delete window.$;

  let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
  webpackChunkdiscord_app.pop();

  let ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getStreamerActiveStreamMetadata).exports.Z;
  let RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.ZP?.getRunningGames).exports.ZP;
  let QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getQuest).exports.Z;
  let ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getAllThreadsForParent).exports.Z;
  let GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.ZP?.getSFWDefaultChannel).exports.ZP;
  let FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.flushWaitQueue).exports.Z;
  let api = Object.values(wpRequire.c).find(x => x?.exports?.tn?.get).exports.tn;

  let isApp = typeof DiscordNative !== "undefined";

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function retryApiCall(fn, retries = 3, delay = 500) {
    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        if (e.status === 500) {
          await sleep(delay);
          delay *= 1.5;
        } else {
          break;
        }
      }
    }
    throw lastError;
  }

  async function retryHeartbeat(questId, body, maxRetries = 3) {
    let attempt = 0;
    let delay = 500;
    while (attempt < maxRetries) {
      try {
        let res = await api.post({ url: `/quests/${questId}/heartbeat`, body });
        return res;
      } catch (e) {
        if (e.status === 500) {
          await sleep(delay);
          delay *= 1.5;
          attempt++;
        } else {
          throw e;
        }
      }
    }
    throw new Error(`Failed heartbeat after ${maxRetries} attempts for quest ${questId}`);
  }

  const quests = [...QuestsStore.quests.values()].filter(quest =>
    quest.id !== "1412491570820812933" &&
    quest.userStatus?.enrolledAt &&
    !quest.userStatus?.completedAt &&
    new Date(quest.config.expiresAt).getTime() > Date.now()
  );

  if (!quests.length) {
    console.log("No uncompleted quests found.");
  } else {
    await Promise.all(quests.map(async quest => {
      try {
        const pid = Math.floor(Math.random() * 30000) + 1000;
        const applicationId = quest.config.application.id;
        const applicationName = quest.config.application.name;
        const questName = quest.config.messages.questName;
        const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
        const taskName = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"].find(x => taskConfig.tasks[x] != null);
        const secondsNeeded = taskConfig.tasks[taskName].target;
        let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;

        if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
          const maxFuture = 15, speed = 30, interval = 200;
          const enrolledAt = new Date(quest.userStatus.enrolledAt).getTime();
          let completed = false;
          while (true) {
            const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + maxFuture;
            const diff = maxAllowed - secondsDone;
            const timestamp = secondsDone + speed;
            if (diff >= speed) {
              const res = await retryApiCall(() => api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: Math.min(secondsNeeded, timestamp + Math.random() * 5) } }));
              completed = res.body.completed_at != null;
              secondsDone = Math.min(secondsNeeded, timestamp);
            }
            if (timestamp >= secondsNeeded || completed) break;
            await sleep(interval);
          }
          if (!completed)
            await retryApiCall(() => api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: secondsNeeded } }));

        } else if (taskName === "PLAY_ON_DESKTOP") {
          if (!isApp) return;
          const appDataRes = await retryApiCall(() => api.get({ url: `/applications/public?application_ids=${applicationId}` }));
          const appData = appDataRes.body[0];
          const exeName = appData.executables.find(x => x.os === "win32").name.replace(">", "");

          const fakeGame = {
            cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
            exeName,
            exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
            hidden: false,
            isLauncher: false,
            id: applicationId,
            name: appData.name,
            pid: pid,
            pidPath: [pid],
            processName: appData.name,
            start: Date.now(),
          };
          const realGames = RunningGameStore.getRunningGames();
          const realGetRunningGames = RunningGameStore.getRunningGames;
          const realGetGameForPID = RunningGameStore.getGameForPID;
          RunningGameStore.getRunningGames = () => [fakeGame];
          RunningGameStore.getGameForPID = (pid) => [fakeGame].find(x => x.pid === pid);
          FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: realGames, added: [fakeGame], games: [fakeGame] });

          let completeHandler;
          await new Promise(resolve => {
            completeHandler = data => {
              let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value);
              if (progress >= secondsNeeded) {
                RunningGameStore.getRunningGames = realGetRunningGames;
                RunningGameStore.getGameForPID = realGetGameForPID;
                FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: [] });
                FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", completeHandler);
                resolve();
              }
            };
            FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", completeHandler);
          });

        } else if (taskName === "STREAM_ON_DESKTOP") {
          if (!isApp) return;
          let realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
          ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
            id: applicationId, pid, sourceName: null
          });

          let completeHandler;
          await new Promise(resolve => {
            completeHandler = data => {
              let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value);
              if (progress >= secondsNeeded) {
                ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
                FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", completeHandler);
                resolve();
              }
            };
            FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", completeHandler);
          });

        } else if (taskName === "PLAY_ACTIVITY") {
          const channelId = ChannelStore.getSortedPrivateChannels()[0]?.id ?? Object.values(GuildChannelStore.getAllGuilds()).find(x => x != null && x.VOCAL.length > 0).VOCAL[0].channel.id;
          const streamKey = `call:${channelId}:1`;
          while (true) {
            try {
              const res = await retryHeartbeat(quest.id, { stream_key: streamKey, terminal: false });
              const progress = res.body.progress.PLAY_ACTIVITY.value;
              if (progress >= secondsNeeded) {
                await retryHeartbeat(quest.id, { stream_key: streamKey, terminal: true });
                break;
              }
            } catch {
              break;
            }
            await sleep(3000);
          }
        }
      } catch {}
    }));
  }
})();

