/*
 * This file is part of INSPIRE.
 * Copyright (C) 2014 CERN.
 *
 * INSPIRE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * INSPIRE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with INSPIRE. If not, see <http://www.gnu.org/licenses/>.
 *
 * In applying this licence, CERN does not waive the privileges and immunities
 * granted to it by virtue of its status as an Intergovernmental Organization
 * or submit itself to any jurisdiction.
 */

define([
  'js/deposit/extended_typeahead'
], function(ExtendedTypeahead) {

  /**
   * Removes non alpha-numeric characters from beginning and end of a string.
   *
   * @param str {String} input string
   * @returns {String} trimmed string
   * @private
   */
  function _trimNonAlphaNumericChar(str) {
    return str.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/ig, '');
  }

   /**
   * Tokenizer used by the bloodhound engine
   *
   * @param datum {Object} an item returned by query
   * @returns {Array} array of tokens; the result query is a one consisting of queries
   *   for every token connected with OR operator
   */
  function datumTokenizer(datum) {
    if ((typeof datum) === 'string' || !datum.institution) {
      return [datum];
    }
    var tokens = [];
    datum = datum.institution;
    if (datum.name && (typeof datum.name) === 'string') {
      var titleNameTokens = datum.name.split(/\s+/);
      titleNameTokens = $.map(titleNameTokens, _trimNonAlphaNumericChar);
      tokens = tokens.concat(titleNameTokens);
    }
    if (datum.affiliation && (typeof datum.affiliation) === 'string') {
      tokens = tokens.concat(datum.place.split(/,?\s+/));
    }
    return tokens;
  }

  function affiliationsTypeahead($element) {
    $element.extendedTypeahead({
      suggestionTemplate: Hogan.compile(
        '<b>{{ affiliation }}</b><br>' +
        '<small>' +
        '{{#department}}Department: {{ department }}<br>{{/department}}' +
        '{{#name}}{{ name }}{{/name}}' +
        '</small>'
      ),
      selectedValueTemplate: Hogan.compile(
        '{{ affiliation }}'
      ),
      cannotFindMessage: 'Cannot find this affiliation in our database.',
      dataKey: 'institution',
      dataEngine: new Bloodhound({
        name: 'affiliations',
        remote: '/search?cc=Institutions&p=%QUERY*&of=recjson&f=affautocomplete',
        datumTokenizer: function(datum) {
          return datumTokenizer.call(this, datum);
        },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        limit: 100,
      })
    });

    return $element;
  }

  return affiliationsTypeahead;
});
