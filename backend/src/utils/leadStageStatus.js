/**
 * Utility for bidirectional mapping and synchronization between
 * Pipeline Stages (stageId, name, category) and Lead Status (canonical status).
 */

const CANONICAL_STATUSES = ['new_lead', 'contacted', 'in_progress', 'qualified', 'won', 'lost', 'open'];

/**
 * Map a pipeline stage object to a canonical lead status string.
 * @param {Object} stage - { stageId, name, category }
 * @returns {string} - canonical status ('new_lead', 'contacted', 'in_progress', 'won', 'lost', 'open')
 */
function mapStageToCanonicalStatus(stage) {
  if (!stage) return 'open';

  const category = (stage.category || '').toLowerCase();
  if (category === 'won') return 'won';
  if (category === 'lost') return 'lost';

  const sId = (stage.stageId || '').toLowerCase();
  const sName = (stage.name || '').toLowerCase();

  if (
    sId.includes('won') ||
    sId.includes('converted') ||
    sId.includes('admitted') ||
    sName.includes('won') ||
    sName.includes('converted') ||
    sName.includes('admission confirmed') ||
    sName.includes('admitted')
  ) {
    return 'won';
  }
  if (
    sId.includes('lost') ||
    sId.includes('dropped') ||
    sId.includes('declined') ||
    sName.includes('lost') ||
    sName.includes('declined') ||
    sName.includes('not interested') ||
    sName.includes('dropped')
  ) {
    return 'lost';
  }

  if (sId.includes('new') || sId.includes('inquiry') || sId.includes('received') || sName.includes('received') || sName.includes('inquiry')) {
    return 'new_lead';
  }
  if (sId.includes('contact') || sId.includes('tele') || sName.includes('counselling') || sName.includes('contact')) {
    return 'contacted';
  }
  if (sId.includes('shortlist') || sId.includes('visit') || sId.includes('negotiat') || sId.includes('progress') || sName.includes('visit') || sName.includes('booking')) {
    return 'in_progress';
  }

  return 'open';
}

/**
 * Cleanly resolve stage and status for lead creation and updates.
 * Prevents raw stage IDs (e.g. 'stage_1730000000000') from corrupting lead.status.
 */
function resolveStageAndStatus({ stageId, status, pipeline }) {
  let resolvedStage = stageId;
  let resolvedStatus = status;

  if (pipeline && Array.isArray(pipeline.stages)) {
    if (stageId) {
      const matched = pipeline.stages.find((s) => s.stageId === stageId);
      if (matched) {
        resolvedStatus = mapStageToCanonicalStatus(matched);
      }
    } else if (status) {
      const matched = pipeline.stages.find(
        (s) =>
          s.stageId === status ||
          s.name.toLowerCase() === status.toLowerCase() ||
          (s.category && s.category.toLowerCase() === status.toLowerCase()) ||
          mapStageToCanonicalStatus(s) === status.toLowerCase()
      );
      if (matched) {
        resolvedStage = matched.stageId;
        resolvedStatus = mapStageToCanonicalStatus(matched);
      }
    }
  }

  // If stageId provided without pipeline context, derive status safely
  if (resolvedStage && (!resolvedStatus || resolvedStatus.startsWith('stage_'))) {
    resolvedStatus = mapStageToCanonicalStatus({ stageId: resolvedStage });
  }

  // Guarantee resolvedStatus is strictly canonical (never a display name, arbitrary string, or raw stage ID)
  if (resolvedStatus && !CANONICAL_STATUSES.includes(resolvedStatus)) {
    resolvedStatus = mapStageToCanonicalStatus({
      stageId: resolvedStage || resolvedStatus,
      name: resolvedStatus,
    });
  }

  if (!CANONICAL_STATUSES.includes(resolvedStatus)) {
    resolvedStatus = 'open';
  }

  return {
    pipelineStage: resolvedStage,
    pipeline_stage: resolvedStage,
    status: resolvedStatus,
  };
}

module.exports = {
  CANONICAL_STATUSES,
  mapStageToCanonicalStatus,
  resolveStageAndStatus,
};
