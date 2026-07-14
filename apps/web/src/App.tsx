import type {
  FinishSessionResponse,
  LevelDto,
  StartSessionResponse,
  SubmitAnswerResponse,
  TankDto,
  UpgradeTankResponse,
} from '@tankquest/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiClient } from './client/api-client.js';
import { clientConfig } from './client/runtime-config.js';
import { GameCanvas } from './game/GameCanvas.js';
import { levelRuntimeConfig } from './game/config/level-runtime-config.js';
import type { RuntimeState } from './game/runtime/types.js';
import { MissionResult } from './MissionResult.js';
import './styles.css';

const api = new ApiClient(clientConfig.apiBaseUrl);

type Phase = 'loading' | 'ready' | 'active' | 'finished';

export function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [levels, setLevels] = useState<LevelDto[]>([]);
  const [tanks, setTanks] = useState<TankDto[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [session, setSession] = useState<StartSessionResponse | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [feedback, setFeedback] = useState<SubmitAnswerResponse | null>(null);
  const [settlement, setSettlement] = useState<FinishSessionResponse | null>(
    null
  );
  const [upgrade, setUpgrade] = useState<UpgradeTankResponse | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState>({
    enemiesRemaining: 0,
    shotsFired: 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questionStartedAt = useRef(0);
  const sessionStartedAt = useRef(0);

  useEffect(() => {
    let active = true;
    void Promise.all([api.listLevels(), api.listTanks()])
      .then(([availableLevels, availableTanks]) => {
        if (!active) return;
        setLevels(availableLevels);
        setTanks(availableTanks);
        setSelectedLevelId(
          (current) => current || availableLevels[0]?.id || ''
        );
        setPhase('ready');
      })
      .catch((reason: unknown) => {
        if (active) setError(readError(reason));
      });
    return () => {
      active = false;
    };
  }, []);

  const runtimeConfig = useMemo(
    () => (session ? levelRuntimeConfig(session.level, session.tank) : null),
    [session]
  );
  const currentQuestion = session?.questions[questionIndex];
  const selectedTank = session?.tank ?? tanks[0];

  const startTraining = async () => {
    const level = levels.find((item) => item.id === selectedLevelId);
    const tank = tanks[0];
    if (!level || !tank) {
      setError('No published level or available tank was found.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const started = await api.startSession({
        childId: clientConfig.demoChildId,
        levelId: level.id,
        tankId: tank.id,
      });
      setSession(started);
      setRuntime({
        enemiesRemaining: levelRuntimeConfig(started.level, started.tank)
          .enemies.length,
        shotsFired: 0,
      });
      setQuestionIndex(0);
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

  const submitAnswer = async (selectedAnswerId: string) => {
    if (!session || !currentQuestion || feedback) return;
    setBusy(true);
    setError(null);
    try {
      setFeedback(
        await api.submitAnswer(session.sessionId, {
          questionId: currentQuestion.id,
          selectedAnswerId,
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
    if (!selectedTank) return;
    setBusy(true);
    setError(null);
    try {
      setUpgrade(
        await api.upgradeTank(
          clientConfig.demoChildId,
          selectedTank.id,
          'firepower'
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
    setSettlement(null);
    setUpgrade(null);
    setError(null);
    setRuntime({ enemiesRemaining: 0, shotsFired: 0 });
  };

  return (
    <main className="app-shell">
      <header className="hud">
        <div>
          <p className="eyebrow">Training Base</p>
          <h1>TankQuest Academy</h1>
        </div>
        <dl>
          <div>
            <dt>Training robots</dt>
            <dd>{runtime.enemiesRemaining}</dd>
          </div>
          <div>
            <dt>Shots fired</dt>
            <dd>{runtime.shotsFired}</dd>
          </div>
        </dl>
      </header>

      {phase === 'loading' && (
        <StatusCard>Loading training catalog…</StatusCard>
      )}

      {phase === 'ready' && (
        <StatusCard>
          <h2>Choose a training mission</h2>
          <p>{levels.length} training missions are ready.</p>
          <div className="mission-picker" aria-label="Training missions">
            {levels.map((level) => (
              <button
                key={level.id}
                className={level.id === selectedLevelId ? 'selected' : ''}
                aria-pressed={level.id === selectedLevelId}
                onClick={() => setSelectedLevelId(level.id)}
              >
                {formatMissionName(level.code)} · difficulty{' '}
                {level.baseDifficulty}
              </button>
            ))}
          </div>
          <button disabled={busy} onClick={() => void startTraining()}>
            Start training
          </button>
        </StatusCard>
      )}

      {phase === 'active' && runtimeConfig && currentQuestion && (
        <>
          <p className="mission-status">
            {formatMissionName(session.level.code)} · Firepower{' '}
            {session.tank.stats.firepower} · Mobility{' '}
            {session.tank.stats.mobility}
          </p>
          <GameCanvas config={runtimeConfig} onState={handleRuntime} />
          <section className="learning-console" aria-live="polite">
            <p className="eyebrow">
              Supply challenge {questionIndex + 1}/{session.questions.length}
            </p>
            <h2>{currentQuestion.prompt}</h2>
            <div className="choices">
              {currentQuestion.choices.map((choice) => (
                <button
                  key={choice.id}
                  disabled={busy || Boolean(feedback)}
                  onClick={() => void submitAnswer(choice.id)}
                >
                  {choice.text}
                </button>
              ))}
            </div>
            {feedback && (
              <div className={feedback.correct ? 'feedback good' : 'feedback'}>
                <strong>
                  {feedback.correct ? 'Supply secured!' : 'Try the next one.'}
                </strong>
                <span>{feedback.explanation}</span>
                <button disabled={busy} onClick={() => void continueTraining()}>
                  {questionIndex < session.questions.length - 1
                    ? 'Next challenge'
                    : 'Complete mission'}
                </button>
              </div>
            )}
          </section>
          <p className="controls">
            W/S drive · A/D turn · Mouse aim · Click or Space fire
          </p>
        </>
      )}

      {phase === 'finished' && settlement && selectedTank && (
        <MissionResult
          busy={busy}
          settlement={settlement}
          tank={selectedTank}
          upgrade={upgrade}
          onContinue={continueWithUpgrade}
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

function readError(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : 'An unexpected error occurred.';
}

function formatMissionName(code: string) {
  const value = code.replaceAll('-', ' ');
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
