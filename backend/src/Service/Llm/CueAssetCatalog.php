<?php

namespace App\Service\Llm;

use App\Entity\Avatar;
use App\Entity\User;
use App\Repository\AnimationRepository;
use App\Service\SharedAssetCatalog;

final class CueAssetCatalog
{
    public function __construct(
        private AnimationRepository $animationRepository,
        private SharedAssetCatalog $sharedAssetCatalog,
        private EmotionVocabulary $emotionVocabulary,
    ) {
    }

    /**
     * @return list<CueAsset>
     */
    public function listForAvatar(User $user, Avatar $avatar): array
    {
        $assets = [];

        foreach ($this->animationRepository->findAvailableForAvatar($user, $avatar) as $animation) {
            $assets[] = new CueAsset(
                sprintf('user:%d', $animation->getId() ?? 0),
                trim((string) $animation->getName()),
                trim((string) $animation->getName()),
                $animation->getKind(),
                trim((string) ($animation->getDescription() ?? '')),
                $this->normalizeKeywords($animation->getKeywords()),
                $this->emotionVocabulary->normalizeMany($animation->getEmotionTags()),
                'user',
            );
        }

        foreach ($this->sharedAssetCatalog->listAnimations() as $item) {
            $label = trim((string) ($item['label'] ?? $item['name'] ?? ''));
            if ($label === '') {
                continue;
            }

            $keywords = [];
            if (is_array($item['keywords'] ?? null)) {
                $keywords = array_merge($keywords, array_map('strval', $item['keywords']));
            }
            if (is_array($item['tags'] ?? null)) {
                $keywords = array_merge($keywords, array_map('strval', $item['tags']));
            }

            $emotionCandidates = [];
            if (is_array($item['emotionTags'] ?? null)) {
                $emotionCandidates = array_merge($emotionCandidates, array_map('strval', $item['emotionTags']));
            }
            if (is_array($item['tags'] ?? null)) {
                $emotionCandidates = array_merge($emotionCandidates, array_map('strval', $item['tags']));
            }

            $assets[] = new CueAsset(
                (string) ($item['id'] ?? 'shared:'.$label),
                $label,
                $label,
                (string) ($item['kind'] ?? 'action'),
                trim((string) ($item['description'] ?? '')),
                $this->normalizeKeywords($keywords),
                $this->emotionVocabulary->normalizeMany($emotionCandidates),
                'shared',
            );
        }

        usort($assets, static function (CueAsset $left, CueAsset $right): int {
            $sourcePriority = $left->source === $right->source
                ? 0
                : ($left->source === 'user' ? -1 : 1);
            if ($sourcePriority !== 0) {
                return $sourcePriority;
            }

            return [$left->kind, $left->label] <=> [$right->kind, $right->label];
        });

        return $assets;
    }

    /**
     * @param list<CueAsset> $assets
     *
     * @return list<CueAsset>
     */
    public function listMovementAssets(array $assets): array
    {
        return array_values(array_filter($assets, static fn (CueAsset $asset): bool => $asset->isMovement()));
    }

    /**
     * @param list<CueAsset> $assets
     *
     * @return list<CueAsset>
     */
    public function listExpressionAssets(array $assets): array
    {
        return array_values(array_filter($assets, static fn (CueAsset $asset): bool => $asset->isExpression()));
    }

    /**
     * @param list<CueAsset> $assets
     *
     * @return list<string>
     */
    public function listAvailableEmotions(array $assets): array
    {
        $emotions = [];

        foreach ($assets as $asset) {
            $emotions = array_merge($emotions, $asset->emotionTags);
        }

        $emotions = array_values(array_unique($emotions));
        sort($emotions);

        return $emotions !== [] ? $emotions : $this->emotionVocabulary->all();
    }

    /**
     * @param list<string> $keywords
     *
     * @return list<string>
     */
    private function normalizeKeywords(array $keywords): array
    {
        $normalized = array_map(
            static fn (mixed $value): string => trim((string) $value),
            $keywords,
        );

        return array_values(array_unique(array_filter($normalized)));
    }
}
