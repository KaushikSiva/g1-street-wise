"""Jointly trained RGB perception encoder for PPO's multi-input policy."""
import torch
from torch import nn
from stable_baselines3.common.torch_layers import BaseFeaturesExtractor


class VisionFeatures(BaseFeaturesExtractor):
    def __init__(self, observation_space):
        super().__init__(observation_space, features_dim=136)
        self.encoder = nn.Sequential(
            nn.Conv2d(6, 16, 5, stride=2), nn.ReLU(),
            nn.Conv2d(16, 32, 3, stride=2), nn.ReLU(),
            nn.Conv2d(32, 32, 3, stride=2), nn.ReLU(), nn.Flatten(),
            nn.Linear(32*6*10, 128), nn.ReLU(),
        )
        self.perception_head = nn.Linear(128, 5)

    def forward(self, observations):
        # SB3 normalizes uint8 images to [0,1] before this extractor.
        encoded = self.encoder(observations['image'])
        return torch.cat([encoded, observations['proprio']], dim=1)

    def perception(self, normalized_images):
        return self.perception_head(self.encoder(normalized_images))
