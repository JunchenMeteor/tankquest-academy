import type {
  FinishSessionResponse,
  LevelDto,
  OwnedTankDto,
  StartSessionResponse,
  SubmitAnswerResponse,
  TankSkinDto,
  UpgradeTankResponse,
} from '@tankquest/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { emptyRuntimeState, readError } from './app-state.js';
import { ApiClient } from './client/api-client.js';
import { AssetClient, type AssetBundle } from './client/assets/index.js';
import { clientConfig } from './client/runtime-config.js';
import { platformClient } from './client/platform/platform-client.js';
import { levelRuntimeConfig } from './game/config/level-runtime-config.js';
import type { RuntimeState } from './game/runtime/types.js';
import { useI18n } from './i18n/I18nProvider.js';
import { MissionResult } from './MissionResult.js';
import { useTheme } from './theme/ThemeProvider.js';
import { ActiveTraining, AppHud, MissionPicker } from './TrainingViews.js';
import './styles.css';

const api = new ApiClient(clientConfig.apiBaseUrl);
const assetClient = new AssetClient(api);

type Phase = 'loading' | 'ready' | 'active' | 'finished';

export function App() {
  const { locale, t } = useI18n();
  const { theme } = useTheme();
  const [phase, setPhase] = useState<Phase>('loading');
  const [levels, setLevels] = useState<LevelDto[]>([]);
  const [tanks, setTanks] = useState<OwnedTankDto[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedTankId, setSelectedTankId] = useState('');
  const [skins, setSkins] = useState<TankSkinDto[]>([]);
  const [session, setSession] = useState<StartSessionResponse | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [learningComplete, setLearningComplete] = useState(false);
  const [feedback, setFeedback] = useState<SubmitAnswerResponse | null>(null);
  const [settlement, setSettlement] = useState<FinishSessionResponse | null>(
    null
  );
  const [upgrade, setUpgrade] = useState<UpgradeTankResponse | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState>(emptyRuntimeState);
  const [visualResources, setVisualResources] = useState<AssetBundle | null>(
    null
  );
  const [previewVisualResources, setPreviewVisualResources] =
    useState<AssetBundle | null>(null);
  const [sessionTheme, setSessionTheme] = useState<
    'training-base' | 'forest-camp' | 'snow-field'
  >('training-base');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(() => platformClient.isOnline());
  const [error, setError] = useState<string | null>(null);
  const questionStartedAt = useRef(0);
  const sessionStartedAt = useRef(0);

  useEffect(() => {
    return platformClient.subscribeNetwork(setOnline);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api.listLevels(),
      api.listOwnedTanks(clientConfig.demoChildId),
    ])
      .then(([availableLevels, availableTanks]) => {
        if (!active) return;
        setLevels(availableLevels);
        setTanks(availableTanks);
        setSelectedLevelId(
          (current) => current || availableLevels[0]?.id || ''
        );
        setSelectedTankId((current) => current || availableTanks[0]?.id || '');
        setPhase('ready');
      })
      .catch((reason: unknown) => {
        if (active) setError(readError(reason));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTankId) return;
    let active = true;
    setSkins([]);
    void api
      .listTankSkins(clientConfig.demoChildId, selectedTankId)
      .then((availableSkins) => {
        if (active) setSkins(availableSkins);
      })
      .catch((reason: unknown) => {
        if (active) setError(readError(reason));
      });
    return () => {
      active = false;
    };
  }, [selectedTankId]);

  useEffect(() => {
    if (!selectedLevelId) return;
    let active = true;
    setPreviewVisualResources(null);
    void assetClient.preloadLevel(selectedLevelId).then((bundle) => {
      if (active) setPreviewVisualResources(bundle);
    });
    return () => {
      active = false;
    };
  }, [selectedLevelId]);

  const runtimeConfig = useMemo(
    () =>
      session
        ? levelRuntimeConfig(
            session.level,
            session.tank,
            locale,
            visualResources ?? undefined,
            sessionTheme
          )
        : null,
    [locale, session, sessionTheme, visualResources]
  );
  const selectedLevel = levels.find((item) => item.id === selectedLevelId);
  const selectedOwnedTank = tanks.find((item) => item.id === selectedTankId);
  const missionPreview = useMemo(
    () =>
      selectedLevel
        ? levelRuntimeConfig(
            selectedLevel,
            selectedOwnedTank,
            locale,
            previewVisualResources?.manifest.levelId === selectedLevel.id
              ? previewVisualResources
              : undefined,
            theme
          )
        : undefined,
    [locale, previewVisualResources, selectedLevel, selectedOwnedTank, theme]
  );
  const currentQuestion = session?.questions[questionIndex];
  const selectedTank = session?.tank ?? selectedOwnedTank;

  const startTraining = async () => {
    if (!online) {
      setError(t('offline.actionBlocked'));
      return;
    }
    const level = selectedLevel;
    const tank = selectedOwnedTank;
    if (!level || !tank) {
      setError(t('app.noContent'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const preparedVisualResources =
        previewVisualResources?.manifest.levelId === level.id
          ? previewVisualResources
          : await assetClient.preloadLevel(level.id);
      const started = await api.startSession({
        childId: clientConfig.demoChildId,
        levelId: level.id,
        tankId: tank.id,
      });
      const startedRuntimeConfig = levelRuntimeConfig(
        started.level,
        started.tank,
        locale
      );
      setVisualResources(preparedVisualResources);
      setSessionTheme(theme);
      setSession(started);
      setRuntime({
        enemiesRemaining: startedRuntimeConfig.enemies.length,
        shotsFired: 0,
        playerHealth: startedRuntimeConfig.player.maxHealth,
        playerMaxHealth: startedRuntimeConfig.player.maxHealth,
        playerDestroyed: false,
      });
      setQuestionIndex(0);
      setLearningComplete(false);
      setFeedback(null);
      setSettlement(null);
      setUpgrade(null);
      sessionStartedAt.current = performance.now();
      questionStartedAt.current = sessionStartedAt.current;
      setPhase('active');
    } catch (reason) {
      setError(readError(reason));
    } finally {
      setBusy(false);
    }
  };

  const equipSkin = async (skinId: string) => {
    if (!online) {
      setError(t('offline.actionBlocked'));
      return;
    }
    if (!selectedOwnedTank) return;
    setBusy(true);
    setError(null);
    try {
      const equipped = await api.equipTankSkin(
        clientConfig.demoChildId,
        selectedOwnedTank.id,
        skinId
      );
      setSkins((current) =>
        current.map((skin) => ({
          ...skin,
          equipped: skin.id === equipped.id,
        }))
      );
      setTanks((current) =>
        current.map((tank) =>
          tank.id === selectedOwnedTank.id ? { ...tank, skin: equipped } : tank
        )
      );
    } catch (reason) {
      setError(readError(reason));
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async (selectedAnswerId: string) => {
    if (!online) {
      setError(t('offline.actionBlocked'));
      return;
    }
    if (!session || !currentQuestion || feedback) return;
    setBusy(true);
    setError(null);
    try {
      setFeedback(
        await api.submitAnswer(session.sessionId, {
          questionId: currentQuestion.id,
          selectedAnswerId,
          locale,
          answerTimeMs: Math.max(
            0,
            Math.round(performance.now() - questionStartedAt.current)
          ),
        })
      );
    } catch (reason) {
      setError(readError(reason));
    } finally {
      setBusy(false);
    }
  };

  const continueTraining = async () => {
    if (!session) return;
    if (questionIndex < session.questions.length - 1) {
      setQuestionIndex((index) => index + 1);
      setFeedback(null);
      questionStartedAt.current = performance.now();
      return;
    }
    if (runtime.enemiesRemaining > 0) {
      setLearningComplete(true);
      setFeedback(null);
      return;
    }

    if (!online) {
      setError(t('offline.actionBlocked'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.recordEvent(session.sessionId, {
        eventType: 'level_finished',
        payload: {
          enemiesRemaining: runtime.enemiesRemaining,
          shotsFired: runtime.shotsFired,
        },
        clientTimeMs: Math.max(
          0,
          Math.round(performance.now() - sessionStartedAt.current)
        ),
      });
      setSettlement(await api.finishSession(session.sessionId));
      setPhase('finished');
    } catch (reason) {
      setError(readError(reason));
    } finally {
      setBusy(false);
    }
  };

  const upgradeFirepower = async () => {
    if (!online) {
      setError(t('offline.actionBlocked'));
      return;
    }
    if (!selectedTank) return;
    setBusy(true);
    setError(null);
    try {
      const upgraded = await api.upgradeTank(
        clientConfig.demoChildId,
        selectedTank.id,
        'firepower'
      );
      setUpgrade(upgraded);
      setTanks((current) =>
        current.map((tank) =>
          tank.id === upgraded.tankId
            ? {
                ...tank,
                stats: { ...tank.stats, firepower: upgraded.effectiveValue },
              }
            : tank
        )
      );
    } catch (reason) {
      setError(readError(reason));
    } finally {
      setBusy(false);
    }
  };

  const handleRuntime = useCallback((state: RuntimeState) => {
    setRuntime(state);
  }, []);

  const continueWithUpgrade = () => {
    setPhase('ready');
    setSession(null);
    setFeedback(null);
    setLearningComplete(false);
    setSettlement(null);
    setUpgrade(null);
    setVisualResources(null);
    setError(null);
    setRuntime(emptyRuntimeState());
  };

  const selectNextPractice = () => {
    const levelId = settlement?.nextPractice?.levelId;
    continueWithUpgrade();
    if (levelId && levels.some((level) => level.id === levelId)) {
      setSelectedLevelId(levelId);
    }
  };

  return (
    <main className="app-shell">
      <AppHud active={phase === 'active'} runtime={runtime} />

      {!online && (
        <p className="offline-banner" role="status">
          {t('offline.banner')}
        </p>
      )}

      {phase === 'loading' && <StatusCard>{t('app.loading')}</StatusCard>}

      {phase === 'ready' && (
        <MissionPicker
          busy={busy}
          online={online}
          levels={levels}
          preview={missionPreview}
          selectedLevelId={selectedLevelId}
          selectedTankId={selectedTankId}
          skins={skins}
          tanks={tanks}
          onSelectLevel={setSelectedLevelId}
          onSelectTank={setSelectedTankId}
          onEquipSkin={(skinId) => void equipSkin(skinId)}
          onStart={() => void startTraining()}
        />
      )}

      {phase === 'active' && session && runtimeConfig && currentQuestion && (
        <ActiveTraining
          busy={busy}
          online={online}
          config={runtimeConfig}
          currentQuestion={currentQuestion}
          feedback={feedback}
          learningComplete={learningComplete}
          questionIndex={questionIndex}
          runtime={runtime}
          session={session}
          onAnswer={(answerId) => void submitAnswer(answerId)}
          onContinue={() => void continueTraining()}
          onRestart={() => void startTraining()}
          onReturn={continueWithUpgrade}
          onRuntime={handleRuntime}
        />
      )}

      {phase === 'finished' && settlement && selectedTank && (
        <MissionResult
          busy={busy}
          online={online}
          settlement={settlement}
          tank={selectedTank}
          upgrade={upgrade}
          onContinue={continueWithUpgrade}
          onNextPractice={selectNextPractice}
          onReplay={() => void startTraining()}
          onUpgrade={() => void upgradeFirepower()}
        />
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}

function StatusCard({ children }: { children: React.ReactNode }) {
  return <section className="status-card">{children}</section>;
}
