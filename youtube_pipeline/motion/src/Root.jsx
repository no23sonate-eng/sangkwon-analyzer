import React from 'react';
import {Composition} from 'remotion';
import {BuildingCard} from './BuildingCard';

const FPS = 30;

export const RemotionRoot = () => {
  return (
    <Composition
      id="BuildingCard"
      component={BuildingCard}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={300}
      defaultProps={{
        title: '소셜아파트 한 동당 객실 수',
        valuePrefix: '30 ~ ',
        valueTarget: 150,
        valueSuffix: '실',
        floors: 8,
        accent: '#A9C6FF',
      }}
      calculateMetadata={async ({props}) => ({
        durationInFrames: Math.round((props.durationSec ?? 10) * FPS),
      })}
    />
  );
};
