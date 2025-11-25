<template>
  <div>
    <p>{{ message }}</p>
    <table border="1" cellpadding="5">
    <thead>
      <tr>
        <th>{{ projectionCode }}-X</th>
        <th>{{ projectionCode }}-Y</th>
        <th>Longitude</th>
        <th>Latitude</th>
      </tr>
    </thead>
    <tbody>
      <td>{{ coordinate.x }}</td>
      <td>{{ coordinate.y }}</td>
      <td>{{ coordinate.lon }}</td>
      <td>{{ coordinate.lat }}</td>
      
    </tbody>
  </table>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps } from 'vue';

interface Coordinate {
  x: number;
  y: number;
  lon: number;
  lat: number;
}

const props = defineProps<{
  message: string;
  projectionCode: string;
  coordinate:  Coordinate;
}>();
</script>

<style scoped>

</style>