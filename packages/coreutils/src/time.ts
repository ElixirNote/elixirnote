// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import moment from 'moment';

/**
 * The namespace for date functions.
 */
export namespace Time {
  /**
   * Convert a timestring to a human readable string (e.g. 'two minutes ago').
   *
   * @param value - The date timestring or date object.
   *
   * @returns A formatted date.
   */
  export function formatHuman(value: string | Date): string {
    moment.locale(document.documentElement.lang);
    let time = moment(value).fromNow();
    // FIXME-TRANS: This is not localization friendly!
    time = time === 'a few seconds ago' ? 'seconds ago' : time;
    return time;
  }

  /**
   * Convert a timestring to a date format.
   *
   * @param value - The date timestring or date object.
   *
   * @param format - The format string.
   *
   * @returns A formatted date.
   */
  export function format(
    value: string | Date,
    timeFormat = 'YYYY-MM-DD HH:mm'
  ): string {
    return moment(value).format(timeFormat);
  }
}
