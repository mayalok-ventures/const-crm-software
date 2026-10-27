import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { patchLocalLeadOptimistic, localDb } from '@/lib/db';
import toast from 'react-hot-toast';

/**
 * High-Speed Optimistic Lead Mutation Hook
 * Delivers 0ms UI response times by immediately mutating Dexie IndexedDB
 * and TanStack Query in-memory cache before awaiting server confirmation.
 */
export function useOptimisticLeadMutation() {
  const queryClient = useQueryClient();

  const updateStageMutation = useMutation({
    mutationFn: async ({ leadId, newStatus, pipelineStage, currentVersion }) => {
      const res = await api.put(`/leads/${leadId}`, {
        status: newStatus,
        pipelineStage: pipelineStage || newStatus,
        version: currentVersion,
      });
      return res.data;
    },
    onMutate: async ({ leadId, newStatus, pipelineStage }) => {
      // 1. Cancel in-flight queries so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['pipeline', 'leads'] });
      await queryClient.cancelQueries({ queryKey: ['leads', 'list'] });

      // 2. Snapshot previous state for rollback
      const previousPipelineData = queryClient.getQueryData(['pipeline', 'leads']);

      // 3. Optimistically update TanStack Query cache
      queryClient.setQueryData(['pipeline', 'leads'], (old) => {
        if (!old || !Array.isArray(old.leads)) return old;
        return {
          ...old,
          leads: old.leads.map((lead) => {
            if (lead._id === leadId || lead.id === leadId) {
              return {
                ...lead,
                status: newStatus,
                pipelineStage: pipelineStage || newStatus,
                updatedAt: new Date().toISOString(),
              };
            }
            return lead;
          }),
        };
      });

      // 4. Optimistically update Dexie IndexedDB for instant 0ms local persistence
      patchLocalLeadOptimistic(leadId, {
        status: newStatus,
        pipelineStage: pipelineStage || newStatus,
      });

      return { previousPipelineData };
    },
    onError: (err, variables, context) => {
      // Rollback on network failure
      if (context?.previousPipelineData) {
        queryClient.setQueryData(['pipeline', 'leads'], context.previousPipelineData);
      }
      
      // If offline, save in queue for background sync
      if (!navigator.onLine && localDb) {
        localDb.offlineMutationQueue.add({
          endpoint: `/leads/${variables.leadId}`,
          method: 'PUT',
          payload: { status: variables.newStatus, pipelineStage: variables.pipelineStage },
          createdAt: Date.now(),
          status: 'pending',
        });
        toast('Offline: Changes saved locally and will sync when reconnected.', { icon: '💾' });
        return;
      }

      toast.error(err.response?.data?.message || 'Failed to update lead status');
    },
    onSettled: () => {
      // Subtle background revalidation without clearing UI
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'leads'], refetchType: 'none' });
    },
  });

  return {
    updateStage: (leadId, newStatus, pipelineStage, currentVersion) => {
      return updateStageMutation.mutateAsync({ leadId, newStatus, pipelineStage, currentVersion });
    },
    isUpdating: updateStageMutation.isPending,
  };
}
