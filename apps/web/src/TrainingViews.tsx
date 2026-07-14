import type {
  LevelDto,
  OwnedTankDto,
  QuestionDto,
  StartSessionResponse,
  SubmitAnswerResponse,
} from '@tankquest/shared';

import { GameCanvas } from './game/GameCanvas.js';
import type { RuntimeLevelConfig, RuntimeState } from './game/runtime/types.js';

export function AppHud({
  active,
  runtime,
}: {
  active: boolean;
  runtime: RuntimeState;
}) {
  return (
    <header className="hud">
      <div>
        <p className="eyebrow">Training Base</p>
        <h1>TankQuest Academy</h1>
      </div>
      <dl>
        <div>
          <dt>Training tanks</dt>
          <dd>{runtime.enemiesRemaining}</dd>
        </div>
        <div>
          <dt>Shots fired</dt>
          <dd>{runtime.shotsFired}</dd>
        </div>
        {active && (
          <div>
            <dt>Hull integrity</dt>
            <dd>
              {runtime.playerHealth}/{runtime.playerMaxHealth}
            </dd>
          </div>
        )}
      </dl>
    </header>
  );
}

export function MissionPicker({
  busy,
  levels,
  preview,
  selectedLevelId,
  selectedTankId,
  tanks,
  onSelectLevel,
  onSelectTank,
  onStart,
}: {
  busy: boolean;
  levels: LevelDto[];
  preview: RuntimeLevelConfig | undefined;
  selectedLevelId: string;
  selectedTankId: string;
  tanks: OwnedTankDto[];
  onSelectLevel: (levelId: string) => void;
  onSelectTank: (tankId: string) => void;
  onStart: () => void;
}) {
  return (
    <section className="status-card">
      <h2>Choose a training mission</h2>
      <p>{levels.length} training missions are ready.</p>
      <div className="mission-picker" aria-label="Training missions">
        {levels.map((level) => (
          <button
            key={level.id}
            className={level.id === selectedLevelId ? 'selected' : ''}
            aria-pressed={level.id === selectedLevelId}
            onClick={() => onSelectLevel(level.id)}
          >
            {formatMissionName(level.code)} · difficulty {level.baseDifficulty}
          </button>
        ))}
      </div>
      <h3>Choose your tank</h3>
      <div className="tank-picker" aria-label="Owned tanks">
        {tanks.map((tank) => (
          <button
            key={tank.id}
            className={tank.id === selectedTankId ? 'selected' : ''}
            aria-pressed={tank.id === selectedTankId}
            onClick={() => onSelectTank(tank.id)}
          >
            <strong>{formatMissionName(tank.code)}</strong>
            <span>
              {tank.role} · level {tank.level}
            </span>
            <span>
              Firepower {tank.stats.firepower} · Mobility {tank.stats.mobility}{' '}
              · Armor {tank.stats.armor} · Stealth {tank.stats.stealth} · Vision{' '}
              {tank.stats.vision}
            </span>
          </button>
        ))}
      </div>
      {preview && (
        <p className="mission-preview">
          {formatMapName(preview.mapStyle)} map · {summarizeEnemies(preview)}
        </p>
      )}
      <button disabled={busy} onClick={onStart}>
        Start training
      </button>
    </section>
  );
}

export function ActiveTraining({
  busy,
  config,
  currentQuestion,
  feedback,
  learningComplete,
  questionIndex,
  runtime,
  session,
  onAnswer,
  onContinue,
  onRestart,
  onReturn,
  onRuntime,
}: {
  busy: boolean;
  config: RuntimeLevelConfig;
  currentQuestion: QuestionDto;
  feedback: SubmitAnswerResponse | null;
  learningComplete: boolean;
  questionIndex: number;
  runtime: RuntimeState;
  session: StartSessionResponse;
  onAnswer: (answerId: string) => void;
  onContinue: () => void;
  onRestart: () => void;
  onReturn: () => void;
  onRuntime: (state: RuntimeState) => void;
}) {
  return (
    <>
      <p className="mission-status">
        {formatMissionName(session.level.code)} · Firepower{' '}
        {session.tank.stats.firepower} · Mobility {session.tank.stats.mobility}{' '}
        · Armor {session.tank.stats.armor} · Stealth{' '}
        {session.tank.stats.stealth} · Vision {session.tank.stats.vision}
      </p>
      <p className="combat-readout">
        Shell {config.player.projectileDamage} · Penetration{' '}
        {config.player.projectilePenetration} · Armor{' '}
        {config.player.armorProfile.front}/{config.player.armorProfile.side}/
        {config.player.armorProfile.rear} · Speed {config.player.speed} · Mass{' '}
        {config.player.mass} · Detection {config.player.detectionRange}
      </p>
      <GameCanvas config={config} onState={onRuntime} />
      {runtime.playerDestroyed ? (
        <section className="battle-alert" aria-live="assertive">
          <p className="eyebrow">Training paused</p>
          <h2>Tank disabled</h2>
          <p>Use your armor and mobility to avoid the next collision.</p>
          <div className="result-actions">
            <button disabled={busy} onClick={onRestart}>
              Restart mission
            </button>
            <button disabled={busy} onClick={onReturn}>
              Return to mission selection
            </button>
          </div>
        </section>
      ) : learningComplete ? (
        <section className="battle-objective" aria-live="polite">
          <p className="eyebrow">Learning supplies secured</p>
          <h2>
            {runtime.enemiesRemaining > 0
              ? `${runtime.enemiesRemaining} training tanks remain`
              : 'Training field secured'}
          </h2>
          <p>Defeat the configured formation to complete the mission.</p>
          {runtime.enemiesRemaining === 0 && (
            <button disabled={busy} onClick={onContinue}>
              Complete mission
            </button>
          )}
        </section>
      ) : (
        <LearningConsole
          busy={busy}
          currentQuestion={currentQuestion}
          feedback={feedback}
          questionCount={session.questions.length}
          questionIndex={questionIndex}
          enemiesRemaining={runtime.enemiesRemaining}
          onAnswer={onAnswer}
          onContinue={onContinue}
        />
      )}
      <p className="controls">
        W/S drive · A/D turn · Mouse aim · Click or Space fire
      </p>
    </>
  );
}

function LearningConsole({
  busy,
  currentQuestion,
  enemiesRemaining,
  feedback,
  questionCount,
  questionIndex,
  onAnswer,
  onContinue,
}: {
  busy: boolean;
  currentQuestion: QuestionDto;
  enemiesRemaining: number;
  feedback: SubmitAnswerResponse | null;
  questionCount: number;
  questionIndex: number;
  onAnswer: (answerId: string) => void;
  onContinue: () => void;
}) {
  return (
    <section className="learning-console" aria-live="polite">
      <p className="eyebrow">
        Supply challenge {questionIndex + 1}/{questionCount}
      </p>
      <h2>{currentQuestion.prompt}</h2>
      <div className="choices">
        {currentQuestion.choices.map((choice) => (
          <button
            key={choice.id}
            disabled={busy || Boolean(feedback)}
            onClick={() => onAnswer(choice.id)}
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
          <button disabled={busy} onClick={onContinue}>
            {questionIndex < questionCount - 1
              ? 'Next challenge'
              : enemiesRemaining > 0
                ? 'Return to battle'
                : 'Complete mission'}
          </button>
        </div>
      )}
    </section>
  );
}

function formatMissionName(code: string) {
  const value = code.replaceAll('-', ' ');
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatMapName(style: RuntimeLevelConfig['mapStyle']) {
  return `${style.charAt(0).toUpperCase()}${style.slice(1)}`;
}

function summarizeEnemies(config: RuntimeLevelConfig) {
  const counts = new Map<string, number>();
  for (const enemy of config.enemies) {
    counts.set(enemy.role, (counts.get(enemy.role) ?? 0) + 1);
  }
  return [...counts]
    .map(([role, count]) => `${count} ${role}${count > 1 ? 's' : ''}`)
    .join(' + ');
}
